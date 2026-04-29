import { projectService } from './project.service.js';
import { pm2Service } from './pm2.service.js';
import type { Project, ProjectStatus } from '@serverctrl/shared';

export class HealthService {
  async checkHealth(project: Project): Promise<{ status: ProjectStatus; responseTime?: number }> {
    // Check PM2 first if linked
    const instances = projectService.getProjectInstances(project.id);
    const pm2Instance = instances.find((i) => i.pm2Name);

    if (pm2Instance?.pm2Name) {
      try {
        const pm2Process = await pm2Service.describe(pm2Instance.pm2Name);
        if (pm2Process) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pm2Data = pm2Process as any;
          const status = pm2Data.pm2_env?.pm2_env?.status === 'online' ? 'running' : 'stopped';
          return { status };
        }
      } catch {
        // PM2 check failed, try HTTP
      }
    }

    // HTTP health check
    if (project.healthCheckUrl) {
      try {
        const start = Date.now();
        const response = await fetch(project.healthCheckUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        const responseTime = Date.now() - start;

        if (response.ok) {
          return { status: 'running', responseTime };
        } else {
          return { status: 'error' };
        }
      } catch {
        return { status: 'error' };
      }
    }

    return { status: 'unknown' };
  }

  async updateAllProjectStatuses(): Promise<void> {
    const projects = projectService.getAllProjects();

    for (const project of projects) {
      try {
        const { status } = await this.checkHealth(project);
        projectService.updateProjectStatus(project.slug, status);
      } catch {
        projectService.updateProjectStatus(project.slug, 'error');
      }
    }
  }
}

export const healthService = new HealthService();
