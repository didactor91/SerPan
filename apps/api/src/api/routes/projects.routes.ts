import { Router, type Router as ExpressRouter } from 'express';
import type { Request, Response } from 'express';
import { projectService } from '../../services/project.service.js';
import { discoveryService } from '../../services/discovery.service.js';
import { healthService } from '../../services/health.service.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router: ExpressRouter = Router();

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
  const { name, slug, description, type, path, domain, healthCheckUrl, healthCheckPort } = req.body;

  if (!name || !slug || !type || !path) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name, slug, type, and path are required',
        statusCode: 400,
      },
    });
    return;
  }

  if (!['pm2', 'docker-compose', 'generic'].includes(type)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'type must be pm2, docker-compose, or generic',
        statusCode: 400,
      },
    });
    return;
  }

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
    description,
    type,
    path,
    domain,
    healthCheckUrl,
    healthCheckPort,
  });
  res.status(201).json({ data: project });
});

// PUT /projects/:slug - Update project
router.put('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'slug is required', statusCode: 400 } });
    return;
  }
  const project = projectService.updateProject(slug, req.body);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
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

export default router;
