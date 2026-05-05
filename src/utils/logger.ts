/**
 * Structured logger that writes to stderr in JSON format.
 * MCP protocol uses stdout for messages, so logs must go to stderr.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(minLevel);
}

export class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level, this.minLevel)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    console.error(JSON.stringify(entry));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

// Global logger instance (configurable via LOG_LEVEL env var)
export const logger = new Logger((process.env.LOG_LEVEL || 'info') as LogLevel);
