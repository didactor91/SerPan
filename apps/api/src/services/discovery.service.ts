/* eslint-disable max-depth, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion */
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
          try {
            const config = this.parseSerpanConfig(configPath);
            if (config) {
              // Check if project already exists by slug
              const existingProject = projectService.getProjectBySlug(
                this.slugify(config.serpan.name),
              );
              if (existingProject) {
                // Skip already registered projects
                continue;
              }

              const createData: {
                name: string;
                slug: string;
                type: import('@serverctrl/shared').ProjectType;
                path: string;
                domain?: string;
                healthCheckUrl?: string;
                healthCheckPort?: number;
              } = {
                name: config.serpan.name,
                slug: this.slugify(config.serpan.name),
                type: config.serpan.type as ProjectType,
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
              discovered++;
            }
          } catch (e) {
            errors.push(`Failed to register ${configPath}: ${e}`);
          }
        }
      } catch (e) {
        errors.push(`Failed to scan ${dir}: ${e}`);
      }
    }

    return { discovered, errors };
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
      const config = JSON.parse(content) as SerpanConfig;

      if (!config.serpan?.name || !config.serpan?.type || !config.serpan?.path) {
        return null;
      }

      return config;
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
