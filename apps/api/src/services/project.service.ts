import { eq } from 'drizzle-orm';
import {
  getDatabase,
  projects,
  projectInstances,
  projectDeploys,
  type ProjectRow,
  type ProjectInstanceRow,
  type ProjectDeployRow,
  mapProject,
  mapProjectInstance,
  mapProjectDeploy,
} from '../db/schema.js';
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
    const allRows = this.db.select().from(projects).orderBy(projects.name).all();
    return allRows.map((row) => mapProject(row as unknown as ProjectRow));
  }

  getProjectBySlug(slug: string): Project | null {
    const row = this.db.select().from(projects).where(eq(projects.slug, slug)).get();
    return row ? mapProject(row as unknown as ProjectRow) : null;
  }

  getProjectInstances(projectId: number): ProjectInstance[] {
    const rows = this.db
      .select()
      .from(projectInstances)
      .where(eq(projectInstances.projectId, projectId))
      .all();
    return rows.map((row) => mapProjectInstance(row as unknown as ProjectInstanceRow));
  }

  createProject(data: Record<string, unknown>): Project {
    this.db
      .insert(projects)
      .values({
        name: data.name as string,
        slug: data.slug as string,
        description: data.description as string | null,
        type: data.type as string,
        path: data.path as string,
        repo: data.repo as string | null,
        branch: data.branch as string | null,
        deployScript: data.deployScript as string | null,
        domain: data.domain as string | null,
        healthCheckUrl: data.healthCheckUrl as string | null,
        healthCheckPort: data.healthCheckPort as number | null,
      })
      .run();

    const newProject = this.getProjectBySlug(data.slug as string);
    if (!newProject) {
      throw new Error(`Project not found after creation: ${String(data.slug)}`);
    }
    return newProject;
  }

  updateProject(slug: string, data: Record<string, unknown>): Project | null {
    const project = this.getProjectBySlug(slug);
    if (!project) return null;

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.repo !== undefined) updateData.repo = data.repo;
    if (data.branch !== undefined) updateData.branch = data.branch;
    if (data.deployScript !== undefined) updateData.deployScript = data.deployScript;
    if (data.deployStatus !== undefined) updateData.deployStatus = data.deployStatus;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.proxyRouteId !== undefined) updateData.proxyRouteId = data.proxyRouteId;
    if (data.healthCheckUrl !== undefined) updateData.healthCheckUrl = data.healthCheckUrl;
    if (data.healthCheckPort !== undefined) updateData.healthCheckPort = data.healthCheckPort;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date().toISOString();
      this.db.update(projects).set(updateData).where(eq(projects.slug, slug)).run();
    }

    return this.getProjectBySlug(slug);
  }

  deleteProject(slug: string): boolean {
    const result = this.db.delete(projects).where(eq(projects.slug, slug)).run();
    return result.changes > 0;
  }

  updateProjectStatus(slug: string, status: ProjectStatus): void {
    this.db
      .update(projects)
      .set({
        status,
        lastHealthCheck: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(projects.slug, slug))
      .run();
  }

  updateDeployStatus(slug: string, status: DeployStatus): void {
    this.db
      .update(projects)
      .set({
        deployStatus: status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(projects.slug, slug))
      .run();
  }

  getProjectDeploys(projectId: number): ProjectDeploy[] {
    const rows = this.db
      .select()
      .from(projectDeploys)
      .where(eq(projectDeploys.projectId, projectId))
      .all();
    return rows
      .map((row) => mapProjectDeploy(row as unknown as ProjectDeployRow))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  createDeploy(data: {
    projectId: number;
    branch: string;
    commitHash: string;
    commitMessage?: string;
  }): ProjectDeploy {
    const result = this.db
      .insert(projectDeploys)
      .values({
        projectId: data.projectId,
        branch: data.branch,
        commitHash: data.commitHash,
        commitMessage: data.commitMessage ?? null,
        status: 'deploying',
        startedAt: new Date().toISOString(),
      })
      .run({ callers: [] });

    const row = this.db
      .select()
      .from(projectDeploys)
      .where(eq(projectDeploys.id, result.lastInsertRowid as number))
      .get();
    return mapProjectDeploy(row as unknown as ProjectDeployRow);
  }

  finishDeploy(deployId: number, status: 'success' | 'failed', output: string): void {
    this.db
      .update(projectDeploys)
      .set({
        status,
        output,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(projectDeploys.id, deployId))
      .run();
  }

  linkToPM2(project: Project, pm2Name: string): ProjectInstance | null {
    // Check if instance already exists
    const existing = this.db
      .select()
      .from(projectInstances)
      .where(eq(projectInstances.projectId, project.id))
      .get();

    if (existing?.pm2Name === pm2Name) {
      return mapProjectInstance(existing as unknown as ProjectInstanceRow);
    }

    const result = this.db
      .insert(projectInstances)
      .values({
        projectId: project.id,
        serverName: 'default',
        pm2Name,
      })
      .run({ callers: [] });

    const row = this.db
      .select()
      .from(projectInstances)
      .where(eq(projectInstances.id, result.lastInsertRowid as number))
      .get();

    return row ? mapProjectInstance(row as unknown as ProjectInstanceRow) : null;
  }
}

export const projectService = new ProjectService();
