/**
 * Structured logger that writes to stderr in JSON format.
 * MCP protocol uses stdout for messages, so logs must go to stderr.
 *
 * Global instance `logger` can be configured via LOG_LEVEL env var (debug/info/warn/error).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Check if a log level meets the minimum threshold.
 * @param level - Message level
 * @param minLevel - Minimum level configured
 * @returns true if message should be logged
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(minLevel);
}

export class Logger {
  private minLevel: LogLevel;

  /**
   * Create a logger with a minimum level.
   * @param minLevel - Messages below this level are ignored (default: 'info')
   */
  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  /**
   * Core logging method: writes JSON line to stderr.
   *
   * Output format: { timestamp, level, message, ...meta }
   *
   * @param level - Log level (debug/info/warn/error)
   * @param message - Human-readable message
   * @param meta - Optional structured metadata (will be spread into output)
   */
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

  /** Log debug-level message (usually omitted in production). */
  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  /** Log info-level message (default minimum). */
  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  /** Log warning message (non-critical issue). */
  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  /** Log error message (failure condition). */
  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

// Global logger instance (configurable via LOG_LEVEL env var)
export const logger = new Logger((process.env.LOG_LEVEL || 'info') as LogLevel);
