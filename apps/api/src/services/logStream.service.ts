import { createReadStream, statSync } from 'fs';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { metricsLogger } from '../lib/logger.js';

export interface LogLine {
  processName: string;
  line: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
}

export interface LogStreamOptions {
  processName: string;
  logPath: string;
  maxLines?: number;
}

export class LogStreamService extends EventEmitter {
  private streams = new Map<string, Readable>();
  private buffers = new Map<string, LogLine[]>();
  private readonly defaultMaxLines = 500;

  parseLine(line: string, processName: string): LogLine {
    // Parse timestamp from log line (common formats)
    // Format: [2026-04-28 10:23:01] or 2026-04-28T10:23:01.000Z
    let timestamp = Date.now();
    let level: 'info' | 'warn' | 'error' = 'info';

    // Detect log level from content
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('err]') || lowerLine.includes('fatal')) {
      level = 'error';
    } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
      level = 'warn';
    }

    // Try to parse timestamp
    const timestampMatch = /\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/.exec(line);
    if (timestampMatch?.[1]) {
      const parsed = new Date(timestampMatch[1]);
      if (!Number.isNaN(parsed.getTime())) {
        timestamp = parsed.getTime();
      }
    }

    return { processName, line, timestamp, level };
  }

  startStream(options: LogStreamOptions): void {
    const { processName, logPath, maxLines = this.defaultMaxLines } = options;

    if (this.streams.has(processName)) {
      return; // Already streaming
    }

    try {
      // Get file size to seek to end
      const stats = statSync(logPath);
      let bytesToSkip = 0;

      // If file is too large, only read last portion
      const maxBytes = maxLines * 200; // ~200 bytes per line estimate
      if (stats.size > maxBytes) {
        bytesToSkip = stats.size - maxBytes;
      }

      const stream = createReadStream(logPath, {
        start: bytesToSkip,
        encoding: 'utf8',
      });

      this.streams.set(processName, stream);
      this.buffers.set(processName, []);

      stream.on('data', (data) => {
        const content = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
        const lines = content.split('\n').filter((l: string) => l.trim());
        const buffer = this.buffers.get(processName) || [];

        for (const line of lines) {
          const parsed = this.parseLine(line, processName);
          buffer.push(parsed);

          if (buffer.length > maxLines) {
            buffer.shift();
          }

          this.emit('line', parsed);
        }

        this.buffers.set(processName, buffer);
      });

      stream.on('error', (error: Error) => {
        metricsLogger.error('Log stream error', { processName, error: error.message });
        this.stopStream(processName);
      });

      stream.on('end', () => {
        this.stopStream(processName);
      });

      metricsLogger.info('Log stream started', { processName, logPath });
    } catch (error) {
      metricsLogger.error('Failed to start log stream', {
        processName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  stopStream(processName: string): void {
    const stream = this.streams.get(processName);
    if (stream) {
      stream.destroy();
      this.streams.delete(processName);
      metricsLogger.info('Log stream stopped', { processName });
    }
  }

  getBuffer(processName: string): LogLine[] {
    return this.buffers.get(processName) || [];
  }

  clearBuffer(processName: string): void {
    this.buffers.set(processName, []);
  }

  stopAll(): void {
    for (const processName of this.streams.keys()) {
      this.stopStream(processName);
    }
  }
}

export const logStreamService = new LogStreamService();
