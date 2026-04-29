/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiLogger } from '../lib/logger.js';
import { exec as execAsync } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execAsync);

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: string[];
  cpuPercent: number;
  memoryPercent: number;
  memoryUsage: string;
  networkMode: string;
}

export class DockerService {
  private async exec(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await exec(command, { maxBuffer: 1024 * 1024 * 10 });
      if (stderr && !stdout) {
        throw new Error(stderr);
      }
      return stdout;
    } catch (err) {
      throw err;
    }
  }

  async listContainers(): Promise<ContainerInfo[]> {
    try {
      const output = await this.exec('docker ps -a --format "{{json .}}" 2>/dev/null || echo "[]"');

      const lines = output
        .trim()
        .split('\n')
        .filter((l: string) => l.trim());
      if (lines.length === 0 || lines[0] === '[]') {
        return [];
      }

      return lines.map((line: string) => {
        const data = JSON.parse(line);
        return {
          id: data.ID || '',
          name: data.Names || '',
          image: data.Image || '',
          status: data.Status || '',
          state: data.State || '',
          created: data.CreatedAt || '',
          ports: data.Ports ? data.Ports.split(',').map((p: string) => p.trim()) : [],
          cpuPercent: 0,
          memoryPercent: 0,
          memoryUsage: '',
          networkMode: data.Networks || '',
        };
      });
    } catch (error) {
      apiLogger.error('Failed to list containers', { error });
      return [];
    }
  }

  async getContainerStats(
    containerName: string,
  ): Promise<{ cpu: number; memory: string; memoryPercent: number } | null> {
    try {
      const output = await this.exec(
        `docker stats ${containerName} --no-stream --format "{{json .}}" 2>/dev/null || echo "{}"`,
      );

      if (!output.trim() || output.trim() === '{}') {
        return null;
      }

      const data = JSON.parse(output);
      const cpuStr = (data.CPU || '0%').replace('%', '');
      const memStr = (data.MemPerc || '0%').replace('%', '');

      return {
        cpu: parseFloat(cpuStr) || 0,
        memory: data.MemUsage || '0MB/0MB',
        memoryPercent: parseFloat(memStr) || 0,
      };
    } catch {
      return null;
    }
  }

  async getContainerLogs(containerName: string, lines = 100): Promise<string[]> {
    try {
      const output = await this.exec(`docker logs ${containerName} --tail ${lines} 2>&1`);
      return output.split('\n').slice(-lines);
    } catch (error) {
      apiLogger.error('Failed to get container logs', { error, containerName });
      return [];
    }
  }

  async startContainer(containerName: string): Promise<boolean> {
    try {
      await this.exec(`docker start ${containerName}`);
      return true;
    } catch (error) {
      apiLogger.error('Failed to start container', { error, containerName });
      return false;
    }
  }

  async stopContainer(containerName: string): Promise<boolean> {
    try {
      await this.exec(`docker stop ${containerName}`);
      return true;
    } catch (error) {
      apiLogger.error('Failed to stop container', { error, containerName });
      return false;
    }
  }

  async restartContainer(containerName: string): Promise<boolean> {
    try {
      await this.exec(`docker restart ${containerName}`);
      return true;
    } catch (error) {
      apiLogger.error('Failed to restart container', { error, containerName });
      return false;
    }
  }

  async getProjectContainers(projectPath: string): Promise<ContainerInfo[]> {
    const allContainers = await this.listContainers();

    // Extract project name from path (e.g., /opt/tortoise-gps -> tortoise-gps)
    const pathParts = projectPath.split('/');
    const projectFolder = pathParts[pathParts.length - 1] || '';

    // Extract prefix: "tortoise-gps" -> "tortoise", "my-project" -> "my"
    // This assumes containers are named "{prefix}-*" (e.g., tortoise-track-app)
    const dashIndex = projectFolder.indexOf('-');
    const prefix = dashIndex > 0 ? projectFolder.substring(0, dashIndex) : projectFolder;
    const prefixDash = prefix + '-';

    // Filter containers by prefix match (e.g., tortoise-gps folder -> tortoise-* containers)
    const projectContainers = allContainers.filter((c) => {
      const nameLower = c.name.toLowerCase();
      return nameLower.startsWith(prefixDash);
    });

    // Enrich with stats
    const enriched = await Promise.all(
      projectContainers.map(async (c) => {
        const stats = await this.getContainerStats(c.name);
        return {
          ...c,
          cpuPercent: stats?.cpu || 0,
          memoryPercent: stats?.memoryPercent || 0,
          memoryUsage: stats?.memory || '',
        };
      }),
    );

    return enriched;
  }

  async getContainerByNamePattern(pattern: string): Promise<ContainerInfo | null> {
    const allContainers = await this.listContainers();
    const normalizedPattern = pattern.replace(/-/g, '').toLowerCase();

    const found = allContainers.find((c) => {
      const normalizedName = c.name.replace(/-/g, '').toLowerCase();
      return (
        normalizedName.includes(normalizedPattern) || normalizedPattern.includes(normalizedName)
      );
    });

    if (!found) return null;

    const stats = await this.getContainerStats(found.name);
    return {
      ...found,
      cpuPercent: stats?.cpu || 0,
      memoryPercent: stats?.memoryPercent || 0,
      memoryUsage: stats?.memory || '',
    };
  }
}

export const dockerService = new DockerService();
