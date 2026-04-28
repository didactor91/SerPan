import { Router, type Router as ExpressRouter } from 'express';
import type { Request, Response } from 'express';
import { pm2Service } from '../../services/pm2.service.js';
import { ValidationError } from '../../middleware/errorHandler.js';

interface ScaleBody {
  instances?: unknown;
}

const router: ExpressRouter = Router();

// GET /processes
router.get('/', async (_req: Request, res: Response) => {
  const processes = await pm2Service.list();
  res.json({ data: { processes } });
});

// POST /processes/:name/start
router.post('/:name/start', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_PARAM', message: 'name is required', statusCode: 400 } });
    return;
  }
  await pm2Service.start(name);
  res.json({ data: { message: `Process ${name} started` } });
});

// POST /processes/:name/stop
router.post('/:name/stop', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_PARAM', message: 'name is required', statusCode: 400 } });
    return;
  }
  await pm2Service.stop(name);
  res.json({ data: { message: `Process ${name} stopped` } });
});

// POST /processes/:name/restart
router.post('/:name/restart', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_PARAM', message: 'name is required', statusCode: 400 } });
    return;
  }
  await pm2Service.restart(name);
  res.json({ data: { message: `Process ${name} restarted` } });
});

// POST /processes/:name/reload
router.post('/:name/reload', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_PARAM', message: 'name is required', statusCode: 400 } });
    return;
  }
  await pm2Service.reload(name);
  res.json({ data: { message: `Process ${name} reloaded` } });
});

// POST /processes/:name/scale
router.post('/:name/scale', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_PARAM', message: 'name is required', statusCode: 400 } });
    return;
  }
  const { instances } = req.body as ScaleBody;

  if (typeof instances !== 'number' || instances < 0) {
    throw new ValidationError('instances must be a non-negative number');
  }

  await pm2Service.scale(name, instances);
  res.json({ data: { message: `Process ${name} scaled to ${String(instances)} instances` } });
});

// GET /processes/:name/logs
router.get('/:name/logs', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_PARAM', message: 'name is required', statusCode: 400 } });
    return;
  }
  const lines = parseInt(req.query.lines as string) || 100;

  const logs = await pm2Service.getLogs(name, lines);
  res.json({ data: { name, logs } });
});

export default router;
