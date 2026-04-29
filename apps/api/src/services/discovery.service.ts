import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { projectService } from './project.service.js';
import type { SerpanConfig, ProjectType } from '@serverctrl/shared';

const SERPAN_CONFIG_FILENAME = 'serpan.json';

export class DiscoveryService {
  discoverProjects(directories: string[] = ['/opt']): { discovered: number; errors: string[] } {
    const errors: string[] = [];
    let discovered = 0;

    for (const dir of directories) {
      try {
        const configs = this.scanForSerpanConfigs(dir);
        for (const configPath of configs) {
          discovered += this.registerProjectFromConfig(configPath) ? 1 : 0;
        }
      } catch (e) {
        errors.push(`Failed to scan ${dir}: ${String(e)}`);
      }
    }

    return { discovered, errors };
  }

  private registerProjectFromConfig(configPath: string): boolean {
    try {
      const config = this.parseSerpanConfig(configPath);
      if (!config) return false;

      const existingProject = projectService.getProjectBySlug(this.slugify(config.serpan.name));
      if (existingProject) return false;

      const createData: {
        name: string;
        slug: string;
        type: ProjectType;
        path: string;
        domain?: string;
        healthCheckUrl?: string;
        healthCheckPort?: number;
      } = {
        name: config.serpan.name,
        slug: this.slugify(config.serpan.name),
        type: config.serpan.type,
        path: config.serpan.path,
      };

      if (config.serpan.proxy?.domain) {
        createData.domain = config.serpan.proxy.domain;
      }
      if (config.serpan.healthCheck?.url) {
        createData.healthCheckUrl = config.serpan.healthCheck.url;
      }
      if (config.serpan.healthCheck?.port !== undefined) {
        createData.healthCheckPort = config.serpan.healthCheck.port;
      }

      const project = projectService.createProject(createData);
      if (config.serpan.pm2?.name) {
        projectService.linkToPM2(project, config.serpan.pm2.name);
      }
      return true;
    } catch (e) {
      throw new Error(`Failed to register ${configPath}: ${String(e)}`);
    }
  }

  private scanForSerpanConfigs(dir: string, depth = 3): string[] {
    const configs: string[] = [];

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory() && depth > 0) {
            const configPath = join(fullPath, SERPAN_CONFIG_FILENAME);
            try {
              statSync(configPath);
              configs.push(configPath);
            } catch {
              // No serpan.json in this directory
              configs.push(...this.scanForSerpanConfigs(fullPath, depth - 1));
            }
          }
        } catch {
          // Skip inaccessible entries
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return configs;
  }

  parseSerpanConfig(configPath: string): SerpanConfig | null {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return null;
      const parsedObj = parsed as Record<string, unknown>;
      if (!('serpan' in parsedObj)) return null;
      const serpan = parsedObj.serpan;
      if (typeof serpan !== 'object' || serpan === null) return null;
      const serpanObj = serpan as Record<string, unknown>;
      if (
        typeof serpanObj.name === 'string' &&
        typeof serpanObj.type === 'string' &&
        typeof serpanObj.path === 'string'
      ) {
        return parsed as SerpanConfig;
      }
      return null;
    } catch {
      return null;
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export const discoveryService = new DiscoveryService();
