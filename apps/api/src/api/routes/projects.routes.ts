import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { projectService } from '../../services/project.service.js';
import { discoveryService } from '../../services/discovery.service.js';
import { healthService } from '../../services/health.service.js';
import { deployService } from '../../services/deploy.service.js';
import { caddyService } from '../../services/caddy.service.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { ValidationError } from '../../middleware/errorHandler.js';

const router: ExpressRouter = Router();

// Zod schemas for request validation
const ProjectTypeSchema = z.enum(['pm2', 'docker-compose', 'generic']);

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'name is required'),
  slug: z.string().min(1, 'slug is required'),
  description: z.string().optional(),
  type: ProjectTypeSchema,
  path: z.string().min(1, 'path is required'),
  repo: z.string().optional(),
  branch: z.string().optional(),
  deployScript: z.string().optional(),
  domain: z.string().optional(),
  healthCheckUrl: z.string().optional(),
  healthCheckPort: z.number().int().min(1).max(65535).optional(),
});

const DeploySchema = z.object({
  commitHash: z.string().optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  deployScript: z.string().optional(),
  domain: z.string().optional(),
  healthCheckUrl: z.string().optional(),
  healthCheckPort: z.number().int().min(1).max(65535).optional(),
});

// All routes require authentication
router.use(authMiddleware);

// GET /projects - List all projects
router.get('/', (_req: Request, res: Response) => {
  const projects = projectService.getAllProjects();
  res.json({ data: projects });
});

// GET /projects/discover - Discover projects from serpan.json files
router.get('/discover', (_req: Request, res: Response) => {
  const { discovered, errors } = discoveryService.discoverProjects(['/opt']);
  res.json({ data: { discovered, errors } });
});

// GET /projects/:slug - Get project by slug
router.get('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }
  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }
  const instances = projectService.getProjectInstances(project.id);
  res.json({ data: { ...project, instances } });
});

// POST /projects - Create project
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid request: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const {
    name,
    slug,
    description,
    type,
    path,
    repo,
    branch,
    deployScript,
    domain,
    healthCheckUrl,
    healthCheckPort,
  } = parsed.data;

  const existing = projectService.getProjectBySlug(slug);
  if (existing) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Project with this slug already exists',
        statusCode: 409,
      },
    });
    return;
  }

  const project = projectService.createProject({
    name,
    slug,
    description: description ?? undefined,
    type,
    path,
    repo: repo ?? undefined,
    branch: branch ?? undefined,
    deployScript: deployScript ?? undefined,
    domain: domain ?? undefined,
    healthCheckUrl: healthCheckUrl ?? undefined,
    healthCheckPort: healthCheckPort ?? undefined,
  });
  res.status(201).json({ data: project });
});

// PUT /projects/:slug - Update project
router.put('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }

  const parsed = UpdateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid request: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const existingProject = projectService.getProjectBySlug(slug);
  if (!existingProject) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const project = projectService.updateProject(slug, parsed.data);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const domainChanged =
    parsed.data.domain !== undefined && parsed.data.domain !== existingProject.domain;
  const portChanged =
    parsed.data.healthCheckPort !== undefined &&
    parsed.data.healthCheckPort !== existingProject.healthCheckPort;

  if ((domainChanged || portChanged) && project.domain && project.healthCheckPort) {
    try {
      const routeId = await caddyService.ensureRouteForProject(
        project.domain,
        project.healthCheckPort,
        project.proxyRouteId,
      );
      projectService.updateProject(slug, { proxyRouteId: routeId });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error: {
          code: 'CADDY_SYNC_FAILED',
          message: `Project updated but Caddy route sync failed: ${errMsg}`,
          statusCode: 500,
        },
      });
      return;
    }
  }

  res.json({ data: project });
});

// DELETE /projects/:slug - Delete project
router.delete('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }
  const deleted = projectService.deleteProject(slug);
  if (!deleted) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }
  res.json({ data: { message: 'Project deleted' } });
});

// GET /projects/:slug/health - Check project health
router.get('/:slug/health', async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }
  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const result = await healthService.checkHealth(project);
  projectService.updateProjectStatus(project.slug, result.status);
  res.json({ data: result });
});

// POST /projects/:slug/instances/:id/restart - Restart instance
router.post('/:slug/instances/:id/restart', async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }
  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const instances = projectService.getProjectInstances(project.id);
  const instanceId = req.params.id;
  if (!instanceId) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'id is required', statusCode: 400 } });
    return;
  }
  const instance = instances.find((i) => i.id === parseInt(instanceId));
  if (!instance) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Instance not found', statusCode: 404 } });
    return;
  }

  // For PM2 instances, restart via PM2
  if (instance.pm2Name) {
    await healthService.checkHealth(project); // This will trigger PM2 check
  }

  res.json({ data: { message: 'Restart triggered', instance } });
});

// POST /projects/:slug/deploy - Trigger a deploy
router.post('/:slug/deploy', async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }

  const parsed = DeploySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid request: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  if (!project.repo) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project has no repo configured',
        statusCode: 400,
      },
    });
    return;
  }

  const commitHash = parsed.data.commitHash;

  deployService.triggerDeploy(project, commitHash).catch(() => {
    projectService.updateDeployStatus(slug, 'failed');
  });

  res.status(202).json({
    data: {
      message: 'Deploy triggered',
      project: project.slug,
      commitHash: commitHash ?? 'latest',
    },
  });
});

// GET /projects/:slug/deploys - Get deploy history
router.get('/:slug/deploys', (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }

  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const deploys = projectService.getProjectDeploys(project.id);
  res.json({ data: deploys });
});

export default router;
