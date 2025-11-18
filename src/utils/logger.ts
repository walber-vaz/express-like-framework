import { context } from '../core/context.js';
import type { Middleware } from './types.js';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Logger options
 */
export interface LoggerOptions {
  level?: LogLevel;
  timestamp?: boolean;
  colors?: boolean;
  prefix?: string;
}

/**
 * Logger class simples
 */
export class Logger {
  private level: LogLevel;
  private timestamp: boolean;
  private colors: boolean;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.timestamp = options.timestamp ?? true;
    this.colors = options.colors ?? true;
    this.prefix = options.prefix ?? '';
  }

  /**
   * Format message with timestamp and request ID
   */
  private format(level: string, ...args: unknown[]): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(new Date().toISOString());
    }

    const requestId = context.getRequestId();
    if (requestId) {
      parts.push(`[${requestId.substring(0, 8)}]`);
    }

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(`[${level}]`);

    return `${parts.join(' ')} ${args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')}`;
  }

  /**
   * Colorize output
   */
  private colorize(text: string, color: string): string {
    if (!this.colors) return text;

    const colors: Record<string, string> = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      gray: '\x1b[90m',
    };

    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  /**
   * Debug log
   */
  public debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = this.format('DEBUG', ...args);
      console.log(this.colorize(message, 'gray'));
    }
  }

  /**
   * Info log
   */
  public info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      const message = this.format('INFO', ...args);
      console.log(this.colorize(message, 'blue'));
    }
  }

  /**
   * Warn log
   */
  public warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      const message = this.format('WARN', ...args);
      console.warn(this.colorize(message, 'yellow'));
    }
  }

  /**
   * Error log
   */
  public error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      const message = this.format('ERROR', ...args);
      console.error(this.colorize(message, 'red'));
    }
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  public getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Instância global do logger
 */
export const logger = new Logger();

/**
 * Middleware de logging de requests
 */
export function requestLogger(options: {
  logger?: Logger;
  includeHeaders?: boolean;
  includeBody?: boolean;
}): Middleware {
  const {
    logger: customLogger = logger,
    includeHeaders = false,
    includeBody = false,
  } = options;

  return (req, res, next) => {
    const start = Date.now();

    // Log request
    const logData: string[] = [`${req.method} ${req.path}`];

    if (includeHeaders) {
      logData.push(`headers: ${JSON.stringify(req.headers)}`);
    }

    if (includeBody && req.body) {
      logData.push(`body: ${JSON.stringify(req.body)}`);
    }

    customLogger.info(...logData);

    // Log response quando terminar
    const originalEnd = res.raw.end;
    res.raw.end = function (
      this: typeof res.raw,
      ...args: any[]
    ): ReturnType<typeof res.raw.end> {
      const duration = Date.now() - start;
      customLogger.info(
        `${req.method} ${req.path} ${res.raw.statusCode} ${duration}ms`,
      );
      // @ts-expect-error - args spreading is fine here
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Middleware de performance logging
 */
export function performanceLogger(options: {
  logger?: Logger;
  threshold?: number; // Log only if duration > threshold (ms)
}): Middleware {
  const { logger: customLogger = logger, threshold = 0 } = options;

  return (req, res, next) => {
    const start = Date.now();

    const originalEnd = res.raw.end;
    res.raw.end = function (
      this: typeof res.raw,
      ...args: any[]
    ): ReturnType<typeof res.raw.end> {
      const duration = Date.now() - start;

      if (duration >= threshold) {
        customLogger.warn(
          `Slow request: ${req.method} ${req.path} took ${duration}ms`,
        );
      }

      // @ts-expect-error - args spreading is fine here
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Create child logger with prefix
 */
export function createLogger(prefix: string, options?: LoggerOptions): Logger {
  return new Logger({ ...options, prefix });
}
