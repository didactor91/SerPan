import { Router, type Router as ExpressRouter } from 'express';
import type { Request, Response } from 'express';
import { logStreamService } from '../../services/logStream.service.js';
import { createReadStream } from 'fs';

const router: ExpressRouter = Router();

// GET /logs/:processName
router.get('/:processName', async (req: Request, res: Response) => {
  const processName = req.params.processName;
  if (!processName) {
    res.status(400).json({
      error: { code: 'MISSING_PARAM', message: 'processName is required', statusCode: 400 },
    });
    return;
  }
  const lines = parseInt(req.query.lines as string) || 100;

  // Get recent lines from PM2 log file
  const logPath = `${process.env.HOME}/.pm2/logs/${processName}-out.log`;

  try {
    const stream = createReadStream(logPath, { encoding: 'utf8' });
    const allLines: string[] = [];

    for await (const chunk of stream) {
      allLines.push(...(chunk as string).split('\n'));
    }

    const recentLines = allLines.slice(-lines).filter((l) => l.trim());
    const parsedLines = recentLines.map((line) => logStreamService.parseLine(line, processName));

    res.json({ data: { processName, lines: parsedLines } });
  } catch {
    res.json({ data: { processName, lines: [], error: 'Log file not found' } });
  }
});

// GET /logs/:processName/download
router.get('/:processName/download', async (req: Request, res: Response) => {
  const { processName } = req.params;
  const logPath = `${process.env.HOME}/.pm2/logs/${processName}-out.log`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${processName}.log"`);

  const stream = createReadStream(logPath);
  stream.pipe(res);
});

export default router;
