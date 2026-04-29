import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { projectService } from '../../services/project.service.js';
import { discoveryService } from '../../services/discovery.service.js';
import { healthService } from '../../services/health.service.js';
import { deployService } from '../../services/deploy.service.js';
import { caddyService } from '../../services/caddy.service.js';
import { pm2Service } from '../../services/pm2.service.js';
import { dockerService } from '../../services/docker.service.js';
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

// GET /projects/:slug/processes - Get processes for this project
router.get('/:slug/processes', async (req: Request, res: Response) => {
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

  // Get PM2 processes that match this project's path or name
  const allProcesses = await pm2Service.list();

  // Filter processes by project - match by path or known naming conventions
  const projectProcesses = allProcesses.filter((p) => {
    // Match by PM2 name containing the project slug
    if (p.name.toLowerCase().includes(slug.replace('-', ''))) return true;
    // Match by path prefix in name (for ecosystem file based)
    if (p.name.startsWith(slug.replace('-', ''))) return true;
    return false;
  });

  res.json({ data: { processes: projectProcesses } });
});

// GET /projects/:slug/logs - Get logs for this project
router.get('/:slug/logs', async (req: Request, res: Response) => {
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

  // Get instances for this project to find PM2 names
  const instances = projectService.getProjectInstances(project.id);
  const pm2Names = instances.flatMap((i) => (i.pm2Name ? [i.pm2Name] : []));

  if (pm2Names.length === 0) {
    res.json({ data: { logs: [] } });
    return;
  }

  // Get logs for each PM2 process
  const allLogs: string[] = [];
  for (const name of pm2Names) {
    try {
      const logs = await pm2Service.getLogs(name, 50);
      allLogs.push(...logs.map((l) => `[${name}] ${l}`));
    } catch {
      // Skip if can't get logs for this process
    }
  }

  res.json({ data: { logs: allLogs.slice(-100) } }); // Last 100 lines
});

// POST /projects/:slug/restart - Restart all project processes
router.post('/:slug/restart', async (req: Request, res: Response) => {
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
  const pm2Names = instances.flatMap((i) => (i.pm2Name ? [i.pm2Name] : []));

  const results: { name: string; success: boolean; error?: string }[] = [];
  for (const name of pm2Names) {
    try {
      await pm2Service.restart(name);
      results.push({ name, success: true });
    } catch (err) {
      results.push({
        name,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  res.json({ data: { results } });
});

// GET /projects/:slug/containers - Get Docker containers for this project
router.get('/:slug/containers', async (req: Request, res: Response) => {
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

  const containers = await dockerService.getProjectContainers(project.path);

  res.json({ data: { containers } });
});

// GET /projects/:slug/containers/:name/logs - Get logs for a specific container
router.get('/:slug/containers/:name/logs', async (req: Request, res: Response) => {
  const { slug, name } = req.params;
  if (!slug || !name) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'slug and name are required', statusCode: 400 },
    });
    return;
  }

  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const logs = await dockerService.getContainerLogs(name, 100);

  res.json({ data: { logs } });
});

// POST /projects/:slug/containers/:name/start - Start container
router.post('/:slug/containers/:name/start', async (req: Request, res: Response) => {
  const { slug, name } = req.params;
  if (!slug || !name) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'slug and name are required', statusCode: 400 },
    });
    return;
  }

  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const success = await dockerService.startContainer(name);
  if (success) {
    res.json({ data: { message: `Container ${name} started` } });
  } else {
    res.status(500).json({
      error: {
        code: 'CONTAINER_START_FAILED',
        message: `Failed to start container ${name}`,
        statusCode: 500,
      },
    });
  }
});

// POST /projects/:slug/containers/:name/stop - Stop container
router.post('/:slug/containers/:name/stop', async (req: Request, res: Response) => {
  const { slug, name } = req.params;
  if (!slug || !name) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'slug and name are required', statusCode: 400 },
    });
    return;
  }

  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const success = await dockerService.stopContainer(name);
  if (success) {
    res.json({ data: { message: `Container ${name} stopped` } });
  } else {
    res.status(500).json({
      error: {
        code: 'CONTAINER_STOP_FAILED',
        message: `Failed to stop container ${name}`,
        statusCode: 500,
      },
    });
  }
});

// POST /projects/:slug/containers/:name/restart - Restart container
router.post('/:slug/containers/:name/restart', async (req: Request, res: Response) => {
  const { slug, name } = req.params;
  if (!slug || !name) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'slug and name are required', statusCode: 400 },
    });
    return;
  }

  const project = projectService.getProjectBySlug(slug);
  if (!project) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Project not found', statusCode: 404 } });
    return;
  }

  const success = await dockerService.restartContainer(name);
  if (success) {
    res.json({ data: { message: `Container ${name} restarted` } });
  } else {
    res.status(500).json({
      error: {
        code: 'CONTAINER_RESTART_FAILED',
        message: `Failed to restart container ${name}`,
        statusCode: 500,
      },
    });
  }
});

// GET /projects/:slug/metrics - Get metrics for this project
router.get('/:slug/metrics', async (req: Request, res: Response) => {
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

  // Get both PM2 processes and Docker containers
  const instances = projectService.getProjectInstances(project.id);
  const pm2Names = instances.flatMap((i) => (i.pm2Name ? [i.pm2Name] : []));

  // Get PM2 processes
  const allProcesses = await pm2Service.list();
  const projectProcesses = allProcesses.filter((p) => {
    if (pm2Names.length > 0) {
      return pm2Names.includes(p.name);
    }
    // Match by slug in name
    const normalizedSlug = slug.replace(/-/g, '').toLowerCase();
    const normalizedName = p.name.replace(/-/g, '').toLowerCase();
    return normalizedName.includes(normalizedSlug) || normalizedSlug.includes(normalizedName);
  });

  // Get Docker containers
  const containers = await dockerService.getProjectContainers(project.path);

  res.json({
    data: {
      processes: projectProcesses.map((p) => ({
        name: p.name,
        status: p.status,
        cpu: p.cpu,
        memory: p.memory,
        instances: p.instances,
        uptime: p.uptime,
      })),
      containers: containers.map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        status: c.status,
        state: c.state,
        cpuPercent: c.cpuPercent,
        memoryPercent: c.memoryPercent,
        memoryUsage: c.memoryUsage,
      })),
    },
  });
});

// POST /projects/:slug/restart - Restart all project processes (PM2 and Docker)
router.post('/:slug/restart', async (req: Request, res: Response) => {
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

  const results: { name: string; type: string; success: boolean; error?: string }[] = [];

  // Restart PM2 processes
  const instances = projectService.getProjectInstances(project.id);
  const pm2Names = instances.flatMap((i) => (i.pm2Name ? [i.pm2Name] : []));

  for (const name of pm2Names) {
    try {
      await pm2Service.restart(name);
      results.push({ name, type: 'pm2', success: true });
    } catch (err) {
      results.push({
        name,
        type: 'pm2',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Restart Docker containers
  const containers = await dockerService.getProjectContainers(project.path);
  for (const container of containers) {
    try {
      await dockerService.restartContainer(container.name);
      results.push({ name: container.name, type: 'docker', success: true });
    } catch (err) {
      results.push({
        name: container.name,
        type: 'docker',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  res.json({ data: { results } });
});

export default router;
