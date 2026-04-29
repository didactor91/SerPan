import { getDatabase } from '../db/schema.js';
import type { Project, ProjectInstance, ProjectType, ProjectStatus } from '@serverctrl/shared';

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

  createProject(data: {
    name: string;
    slug: string;
    description?: string;
    type: ProjectType;
    path: string;
    domain?: string;
    healthCheckUrl?: string;
    healthCheckPort?: number;
  }): Project {
    const stmt = this.db.prepare(`
      INSERT INTO projects (name, slug, description, type, path, domain, health_check_url, health_check_port)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.name,
      data.slug,
      data.description || null,
      data.type,
      data.path,
      data.domain || null,
      data.healthCheckUrl || null,
      data.healthCheckPort || null,
    );
    return this.getProjectBySlug(data.slug)!;
  }

  updateProject(slug: string, data: Partial<Project>): Project | null {
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
    if (data.domain !== undefined) {
      fields.push('domain = ?');
      values.push(data.domain);
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
      domain: row.domain,
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
