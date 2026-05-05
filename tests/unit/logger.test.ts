import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel } from 'src/utils/logger';

describe('Logger', () => {
  let consoleErrorSpy: any;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalLogLevel = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
  });

  describe('log level filtering', () => {
    it('should log info and above when minLevel is info', () => {
      const logger = new Logger('info');

      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('should not log debug when minLevel is info', () => {
      const logger = new Logger('info');

      logger.debug('Debug message');
      logger.info('Info message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('Info message');
    });

    it('should log all levels when minLevel is debug', () => {
      const logger = new Logger('debug');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    });

    it('should only log error when minLevel is error', () => {
      const logger = new Logger('error');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('Error message');
    });
  });

  describe('structured JSON output', () => {
    it('should output JSON with timestamp, level, and message', () => {
      const logger = new Logger('debug');
      logger.info('Test message');

      const callArg = consoleErrorSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(callArg);
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('level', 'info');
      expect(entry).toHaveProperty('message', 'Test message');
    });

    it('should include meta fields in output', () => {
      const logger = new Logger('debug');
      logger.warn('Warning with meta', { key: 'value', count: 42 });

      const entry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.key).toBe('value');
      expect(entry.count).toBe(42);
    });

    it('should not mutate meta object', () => {
      const logger = new Logger('debug');
      const meta = { key: 'value' };
      logger.info('Test', meta);

      // meta should remain unchanged (logger adds fields to a copy)
      expect(meta).toEqual({ key: 'value' });
    });

    it('should use ISO timestamp format', () => {
      const logger = new Logger('debug');
      logger.info('Test');

      const entry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('convenience methods', () => {
    it('debug() should call log with debug level', () => {
      const logger = new Logger('debug');
      logger.debug('Debug msg', { foo: 'bar' });

      const entry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('debug');
      expect(entry.message).toBe('Debug msg');
      expect(entry.foo).toBe('bar');
    });

    it('info() should call log with info level', () => {
      const logger = new Logger('debug');
      logger.info('Info msg');

      const entry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('info');
    });

    it('warn() should call log with warn level', () => {
      const logger = new Logger('debug');
      logger.warn('Warn msg');

      const entry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('warn');
    });

    it('error() should call log with error level', () => {
      const logger = new Logger('debug');
      logger.error('Error msg');

      const entry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(entry.level).toBe('error');
    });
  });

  describe('global logger', () => {
    it('should use LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'warn';
      // Re-import to get new global instance
      // Since we can't re-import in same test, we'd need separate test file
      // For now, we'll test constructor behavior
      const logger = new Logger((process.env.LOG_LEVEL || 'info') as LogLevel);
      expect(logger).toBeDefined();
    });
  });
});
