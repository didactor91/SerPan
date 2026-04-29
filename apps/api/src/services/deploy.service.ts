import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import type { Project } from '@serverctrl/shared';
import { projectService } from './project.service.js';
import { pm2Service } from './pm2.service.js';
import { caddyService } from './caddy.service.js';
import { apiLogger } from '../lib/logger.js';

const execAsync = promisify(exec);

const MAX_OUTPUT_LENGTH = 10 * 1024; // 10KB

function truncateOutput(output: string, maxLength: number): string {
  if (output.length <= maxLength) {
    return output;
  }
  return (
    output.slice(0, maxLength) +
    `\n... [truncated — ${String(output.length - maxLength)} additional characters not stored]`
  );
}

interface DeployScriptResult {
  buildCmd: string;
  restartCmd: string | null;
}

interface DeployResult {
  deployId: number;
  commitHash: string;
  commitMessage: string;
  output: string;
  status: 'success' | 'failed';
}

export function parseDeployScript(script: string): DeployScriptResult {
  if (!script || script.trim().length === 0) {
    return { buildCmd: '', restartCmd: null };
  }

  const trimmed = script.trim();
  const parts = trimmed.split(/\s*&&\s*/);

  if (parts.length === 1) {
    const single = parts[0];
    return { buildCmd: single?.trim() ?? '', restartCmd: null };
  }

  const buildParts = parts.slice(0, -1);
  const lastPart = parts[parts.length - 1];
  const trimmedLast = lastPart !== undefined ? lastPart.trim() : null;
  const restartCmd = trimmedLast !== null && trimmedLast !== '' ? trimmedLast : null;

  return {
    buildCmd: buildParts.map((p) => p.trim()).join(' && '),
    restartCmd,
  };
}

export class DeployService {
  async triggerDeploy(project: Project, commitHash?: string): Promise<DeployResult> {
    if (!project.repo) {
      throw new Error('Project has no repo configured');
    }

    const branch = project.branch ?? 'main';

    apiLogger.info('Starting deploy', { project: project.slug, repo: project.repo, branch });

    projectService.updateDeployStatus(project.slug, 'deploying');

    const deploy = projectService.createDeploy({
      projectId: project.id,
      branch,
      commitHash: commitHash ?? 'pending',
      commitMessage: 'Deploy in progress',
    });

    let output = '';

    try {
      const gitResult = await this._cloneOrPullRepo(project.path, project.repo, branch);
      output += gitResult.output;
      const { actualHash, commitMessage } = gitResult;

      projectService.createDeploy({
        projectId: project.id,
        branch,
        commitHash: actualHash,
        commitMessage,
      });

      if (project.deployScript) {
        output += await this._runDeployScript(project);
      }

      if (project.domain && project.healthCheckPort) {
        output += await this._syncCaddyRoute(project);
      }

      const safeHash = actualHash;
      const safeMessage = commitMessage;

      projectService.finishDeploy(deploy.id, 'success', truncateOutput(output, MAX_OUTPUT_LENGTH));
      projectService.updateDeployStatus(project.slug, 'success');

      apiLogger.info('Deploy completed successfully', {
        project: project.slug,
        deployId: deploy.id,
      });

      return {
        deployId: deploy.id,
        commitHash: safeHash,
        commitMessage: safeMessage,
        output,
        status: 'success',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output += `\n=== DEPLOY FAILED ===\n${errorMessage}\n`;

      projectService.finishDeploy(deploy.id, 'failed', truncateOutput(output, MAX_OUTPUT_LENGTH));
      projectService.updateDeployStatus(project.slug, 'failed');

      apiLogger.error('Deploy failed', {
        project: project.slug,
        deployId: deploy.id,
        error: errorMessage,
      });

      return {
        deployId: deploy.id,
        commitHash: 'failed',
        commitMessage: 'Deploy failed',
        output,
        status: 'failed',
      };
    }
  }

  private async _cloneOrPullRepo(
    workDir: string,
    repo: string,
    branch: string,
  ): Promise<{ actualHash: string; commitMessage: string; output: string }> {
    let output = '';
    const isRepo = existsSync(`${workDir}/.git`);

    if (!isRepo) {
      const { stdout } = await execAsync(
        `git clone --depth=1 --branch=${branch} ${repo} "${workDir}"`,
        { timeout: 120000 },
      );
      output += stdout;
    } else {
      const { stdout } = await execAsync(`git -C "${workDir}" pull origin ${branch}`, {
        timeout: 60000,
      });
      output += stdout;
    }

    const { stdout: hashOut } = await execAsync(`git -C "${workDir}" rev-parse HEAD`);
    const actualHash = hashOut.trim();
    output += `\nCommit: ${actualHash}\n`;

    const { stdout: msgOut } = await execAsync(
      `git -C "${workDir}" log -1 --format="%s" ${actualHash}`,
    );
    const commitMessage = msgOut.trim();

    return { actualHash, commitMessage, output };
  }

  private async _runDeployScript(project: Project): Promise<string> {
    let output = `\n=== Running deploy script ===\n`;
    const script = project.deployScript ?? '';
    const { buildCmd, restartCmd } = parseDeployScript(script);

    if (buildCmd) {
      const { stdout: buildOut, stderr: buildErr } = await execAsync(buildCmd, {
        cwd: project.path,
        timeout: 300000,
      });
      output += buildOut;
      if (buildErr) {
        output += `\nSTDERR:\n${buildErr}`;
      }
    }

    if (restartCmd && project.type === 'pm2') {
      output += `\n=== Restarting PM2 process ===\n`;
      try {
        await pm2Service.restart(project.slug);
        output += `PM2 restart triggered for ${project.slug}\n`;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        apiLogger.warn('PM2 restart failed, may not be managed by PM2', {
          project: project.slug,
          error: errMsg,
        });
        output += `PM2 restart skipped: ${errMsg}\n`;
      }
    }

    return output;
  }

  private async _syncCaddyRoute(project: Project): Promise<string> {
    let output = `\n=== Updating Caddy route ===\n`;
    const domain = project.domain ?? '';
    const port = project.healthCheckPort ?? 0;
    try {
      const routeId = await caddyService.ensureRouteForProject(domain, port, project.proxyRouteId);
      projectService.updateProject(project.slug, { proxyRouteId: routeId });
      output += `Route ${routeId} synced for ${domain}\n`;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      apiLogger.warn('Caddy route update failed', {
        project: project.slug,
        error: errMsg,
      });
      output += `Caddy route update skipped: ${errMsg}\n`;
    }
    return output;
  }
}

export const deployService = new DeployService();
