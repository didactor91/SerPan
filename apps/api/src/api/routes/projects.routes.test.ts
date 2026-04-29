import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/project.service.js', () => ({
  projectService: {
    getAllProjects: vi.fn().mockReturnValue([]),
    getProjectBySlug: vi.fn(),
    getProjectInstances: vi.fn().mockReturnValue([]),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn().mockReturnValue(true),
    updateDeployStatus: vi.fn(),
    getProjectDeploys: vi.fn().mockReturnValue([]),
    createDeploy: vi.fn().mockReturnValue({ id: 1, status: 'deploying' }),
    finishDeploy: vi.fn(),
  },
}));

vi.mock('../../services/discovery.service.js', () => ({
  discoveryService: {
    discoverProjects: vi.fn().mockReturnValue({ discovered: [], errors: [] }),
  },
}));

vi.mock('../../services/health.service.js', () => ({
  healthService: {
    checkHealth: vi.fn(),
  },
}));

vi.mock('../../services/deploy.service.js', () => ({
  deployService: {
    triggerDeploy: vi.fn().mockResolvedValue({ deployId: 1, status: 'success' }),
  },
}));

vi.mock('../../services/caddy.service.js', () => ({
  caddyService: {
    ensureRouteForProject: vi.fn().mockResolvedValue('route_test123'),
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { projectService } = await import('../../services/project.service.js');
const { deployService } = await import('../../services/deploy.service.js');
const { caddyService } = await import('../../services/caddy.service.js');
const { default: projectsRouter } = await import('./projects.routes.js');
import type { Project } from '@serverctrl/shared';

const mockProject: Project = {
  id: 1,
  name: 'Test Project',
  slug: 'test-project',
  type: 'pm2',
  path: '/opt/test-project',
  deployStatus: 'idle',
  healthCheckEnabled: true,
  status: 'running',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('projects.routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/projects', projectsRouter);
  });

  describe('POST /projects/:slug/deploy', () => {
    it('should return 404 when project not found', async () => {
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(null);

      const res = await request(app).post('/projects/nonexistent/deploy');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when project has no repo', async () => {
      const projectNoRepo = { ...mockProject, repo: undefined };
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(projectNoRepo);

      const res = await request(app).post('/projects/test-project/deploy');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Project has no repo configured');
    });

    it('should return 202 and trigger deploy when project has repo', async () => {
      const projectWithRepo = {
        ...mockProject,
        repo: 'git@github.com:test/project.git',
        branch: 'main',
      };
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(projectWithRepo);
      vi.mocked(deployService.triggerDeploy).mockResolvedValueOnce({
        deployId: 1,
        commitHash: 'abc123',
        commitMessage: 'Test commit',
        output: 'Deploy output',
        status: 'success',
      });

      const res = await request(app).post('/projects/test-project/deploy');

      expect(res.status).toBe(202);
      expect(res.body.data.message).toBe('Deploy triggered');
      expect(res.body.data.project).toBe('test-project');
      expect(deployService.triggerDeploy).toHaveBeenCalledWith(projectWithRepo, undefined);
    });

    it('should pass commitHash to triggerDeploy when provided', async () => {
      const projectWithRepo = {
        ...mockProject,
        repo: 'git@github.com:test/project.git',
        branch: 'main',
      };
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(projectWithRepo);

      const res = await request(app)
        .post('/projects/test-project/deploy')
        .send({ commitHash: 'def456' });

      expect(res.status).toBe(202);
      expect(deployService.triggerDeploy).toHaveBeenCalledWith(projectWithRepo, 'def456');
    });
  });

  describe('GET /projects/:slug/deploys', () => {
    it('should return 404 when project not found', async () => {
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(null);

      const res = await request(app).get('/projects/nonexistent/deploys');

      expect(res.status).toBe(404);
    });

    it('should return deploys for existing project', async () => {
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(mockProject);
      vi.mocked(projectService.getProjectDeploys).mockReturnValueOnce([
        {
          id: 1,
          projectId: 1,
          branch: 'main',
          commitHash: 'abc123',
          commitMessage: 'Test',
          status: 'success',
          output: 'Output',
          startedAt: '2026-01-01T00:00:00Z',
        },
      ]);

      const res = await request(app).get('/projects/test-project/deploys');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].commitHash).toBe('abc123');
    });
  });

  describe('PUT /projects/:slug', () => {
    it('should sync Caddy route when domain changes', async () => {
      const existingProject = { ...mockProject, domain: 'old.com', healthCheckPort: 3000 };
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(existingProject);
      vi.mocked(projectService.updateProject).mockReturnValueOnce({
        ...existingProject,
        domain: 'new.com',
        healthCheckPort: 3000,
        proxyRouteId: 'route_test123',
      });

      const res = await request(app).put('/projects/test-project').send({ domain: 'new.com' });

      expect(res.status).toBe(200);
    });

    it('should update project even if Caddy sync fails', async () => {
      const existingProject = { ...mockProject, domain: 'old.com', healthCheckPort: 3000 };
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce(existingProject);
      vi.mocked(projectService.updateProject).mockReturnValueOnce({
        ...existingProject,
        domain: 'new.com',
      });
      vi.mocked(projectService.getProjectBySlug).mockReturnValueOnce({
        ...existingProject,
        domain: 'new.com',
      });

      const { caddyService } = await import('../../services/caddy.service.js');
      vi.mocked(caddyService.ensureRouteForProject).mockRejectedValueOnce(new Error('Caddy error'));

      const res = await request(app).put('/projects/test-project').send({ domain: 'new.com' });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('CADDY_SYNC_FAILED');
    });
  });
});
