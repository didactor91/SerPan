/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-nullish-coalescing */
import { getDatabase } from '../db/schema.js';
import type {
  Project,
  ProjectInstance,
  ProjectStatus,
  DeployStatus,
  ProjectDeploy,
} from '@serverctrl/shared';

export class ProjectService {
  private db = getDatabase();

  getAllProjects(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY name').all() as any[];
    return rows.map(this.mapRowToProject);
  }

  getProjectBySlug(slug: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as any;
    return row ? this.mapRowToProject(row) : null;
  }

  getProjectInstances(projectId: number): ProjectInstance[] {
    const rows = this.db
      .prepare('SELECT * FROM project_instances WHERE project_id = ?')
      .all(projectId) as any[];
    return rows.map(this.mapRowToInstance);
  }

  createProject(data: Record<string, any>): Project {
    const stmt = this.db.prepare(`
      INSERT INTO projects (name, slug, description, type, path, repo, branch, deploy_script, domain, health_check_url, health_check_port)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.name,
      data.slug,
      data.description || null,
      data.type,
      data.path,
      data.repo || null,
      data.branch || null,
      data.deployScript || null,
      data.domain || null,
      data.healthCheckUrl || null,
      data.healthCheckPort || null,
    );
    return this.getProjectBySlug(data.slug)!;
  }

  updateProject(slug: string, data: Record<string, any>): Project | null {
    const project = this.getProjectBySlug(slug);
    if (!project) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.repo !== undefined) {
      fields.push('repo = ?');
      values.push(data.repo);
    }
    if (data.branch !== undefined) {
      fields.push('branch = ?');
      values.push(data.branch);
    }
    if (data.deployScript !== undefined) {
      fields.push('deploy_script = ?');
      values.push(data.deployScript);
    }
    if (data.deployStatus !== undefined) {
      fields.push('deploy_status = ?');
      values.push(data.deployStatus);
    }
    if (data.domain !== undefined) {
      fields.push('domain = ?');
      values.push(data.domain);
    }
    if (data.proxyRouteId !== undefined) {
      fields.push('proxy_route_id = ?');
      values.push(data.proxyRouteId);
    }
    if (data.healthCheckUrl !== undefined) {
      fields.push('health_check_url = ?');
      values.push(data.healthCheckUrl);
    }
    if (data.healthCheckPort !== undefined) {
      fields.push('health_check_port = ?');
      values.push(data.healthCheckPort);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(slug);
      this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE slug = ?`).run(...values);
    }

    return this.getProjectBySlug(slug);
  }

  deleteProject(slug: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE slug = ?').run(slug);
    return result.changes > 0;
  }

  updateProjectStatus(slug: string, status: ProjectStatus): void {
    this.db
      .prepare(
        "UPDATE projects SET status = ?, last_health_check = datetime('now'), updated_at = datetime('now') WHERE slug = ?",
      )
      .run(status, slug);
  }

  updateDeployStatus(slug: string, status: DeployStatus): void {
    this.db
      .prepare("UPDATE projects SET deploy_status = ?, updated_at = datetime('now') WHERE slug = ?")
      .run(status, slug);
  }

  getProjectDeploys(projectId: number): ProjectDeploy[] {
    const rows = this.db
      .prepare('SELECT * FROM project_deploys WHERE project_id = ? ORDER BY started_at DESC')
      .all(projectId) as any[];
    return rows.map(this.mapRowToDeploy);
  }

  createDeploy(data: {
    projectId: number;
    branch: string;
    commitHash: string;
    commitMessage?: string;
  }): ProjectDeploy {
    const stmt = this.db.prepare(`
      INSERT INTO project_deploys (project_id, branch, commit_hash, commit_message, status, started_at)
      VALUES (?, ?, ?, ?, 'deploying', datetime('now'))
    `);
    stmt.run(data.projectId, data.branch, data.commitHash, data.commitMessage || null);
    const row = this.db
      .prepare('SELECT * FROM project_deploys WHERE id = last_insert_rowid()')
      .get() as any;
    return this.mapRowToDeploy(row);
  }

  finishDeploy(deployId: number, status: 'success' | 'failed', output: string): void {
    this.db
      .prepare(
        "UPDATE project_deploys SET status = ?, output = ?, finished_at = datetime('now') WHERE id = ?",
      )
      .run(status, output, deployId);
  }

  private mapRowToDeploy(row: any): ProjectDeploy {
    return {
      id: row.id,
      projectId: row.project_id,
      branch: row.branch,
      commitHash: row.commit_hash,
      commitMessage: row.commit_message,
      status: row.status,
      output: row.output,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    };
  }

  linkToPM2(project: Project, pm2Name: string): ProjectInstance | null {
    // Check if instance already exists
    const existing = this.db
      .prepare('SELECT * FROM project_instances WHERE project_id = ? AND pm2_name = ?')
      .get(project.id, pm2Name) as any;
    if (existing) return this.mapRowToInstance(existing);

    const stmt = this.db.prepare(`
      INSERT INTO project_instances (project_id, server_name, pm2_name)
      VALUES (?, 'default', ?)
    `);
    const result = stmt.run(project.id, pm2Name);
    return this.db
      .prepare('SELECT * FROM project_instances WHERE id = ?')
      .get(result.lastInsertRowid) as any;
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      type: row.type,
      path: row.path,
      serpanConfigPath: row.serpan_config_path,
      repo: row.repo,
      branch: row.branch,
      deployScript: row.deploy_script,
      deployStatus: row.deploy_status ?? 'idle',
      domain: row.domain,
      proxyRouteId: row.proxy_route_id,
      healthCheckUrl: row.health_check_url,
      healthCheckPort: row.health_check_port,
      healthCheckEnabled: Boolean(row.health_check_enabled),
      status: row.status,
      lastHealthCheck: row.last_health_check,
      lastDeploy: row.last_deploy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToInstance(row: any): ProjectInstance {
    return {
      id: row.id,
      projectId: row.project_id,
      serverName: row.server_name,
      serverHost: row.server_host,
      port: row.port,
      pid: row.pid,
      pm2Name: row.pm2_name,
      containerId: row.container_id,
      containerStatus: row.container_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const projectService = new ProjectService();
