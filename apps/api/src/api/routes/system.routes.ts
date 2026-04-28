import { Router, type Router as ExpressRouter } from 'express';
import type { Request, Response } from 'express';
import { systemMetricsService } from '../../services/systemMetrics.service.js';

const router: ExpressRouter = Router();

// GET /system/metrics
router.get('/metrics', async (_req: Request, res: Response) => {
  const metrics = await systemMetricsService.getSnapshot();
  res.json({ data: metrics });
});

// GET /system/metrics/history
router.get('/metrics/history', async (_req: Request, res: Response) => {
  // For MVP Fase 1, we return a placeholder - full history implementation
  // would require metrics to be stored in SQLite and queried
  const metrics = await systemMetricsService.getSnapshot();

  res.json({
    data: {
      history: [metrics],
      note: 'Full history implementation requires metrics collection to be stored in DB',
    },
  });
});

export default router;
