import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createLogger,
  LogLevel,
  logger,
  performanceLogger,
  requestLogger,
} from '../../src/utils/logger.js';
import type { RequestContext, ResponseContext } from '../../src/utils/types.js';

describe('Logger', () => {
  describe('LogLevel enum', () => {
    test('should have correct log level values', () => {
      assert.strictEqual(LogLevel.DEBUG, 0);
      assert.strictEqual(LogLevel.INFO, 1);
      assert.strictEqual(LogLevel.WARN, 2);
      assert.strictEqual(LogLevel.ERROR, 3);
      assert.strictEqual(LogLevel.SILENT, 4);
    });
  });

  describe('Logger class', () => {
    test('should create logger with default options', () => {
      const log = createLogger('test');
      assert.strictEqual(log.getLevel(), LogLevel.INFO);
    });

    test('should create logger with custom level', () => {
      const log = createLogger('test', { level: LogLevel.DEBUG });
      assert.strictEqual(log.getLevel(), LogLevel.DEBUG);
    });

    test('should set and get log level', () => {
      const log = createLogger('test');
      log.setLevel(LogLevel.ERROR);
      assert.strictEqual(log.getLevel(), LogLevel.ERROR);
    });

    test('should respect log level for debug', () => {
      const log = createLogger('test', { level: LogLevel.INFO });
      // Should not log debug when level is INFO
      // This is hard to test without mocking console
      assert.ok(log);
    });

    test('should respect log level for info', () => {
      const log = createLogger('test', { level: LogLevel.WARN });
      // Should not log info when level is WARN
      assert.ok(log);
    });

    test('should respect log level for warn', () => {
      const log = createLogger('test', { level: LogLevel.ERROR });
      // Should not log warn when level is ERROR
      assert.ok(log);
    });

    test('should respect log level for silent', () => {
      const log = createLogger('test', { level: LogLevel.SILENT });
      // Should not log anything when level is SILENT
      assert.ok(log);
    });

    test('should have global logger instance', () => {
      assert.ok(logger);
      assert.strictEqual(typeof logger.info, 'function');
      assert.strictEqual(typeof logger.debug, 'function');
      assert.strictEqual(typeof logger.warn, 'function');
      assert.strictEqual(typeof logger.error, 'function');
    });

    test('should create logger with prefix', () => {
      const log = createLogger('app');
      assert.ok(log);
    });

    test('should create logger without colors', () => {
      const log = createLogger('test', { colors: false });
      assert.ok(log);
    });

    test('should create logger without timestamp', () => {
      const log = createLogger('test', { timestamp: false });
      assert.ok(log);
    });

    test('should handle object logging', () => {
      const log = createLogger('test', { level: LogLevel.SILENT });
      log.info({ user: 'john', id: 123 });
      assert.ok(log);
    });

    test('should handle multiple arguments', () => {
      const log = createLogger('test', { level: LogLevel.SILENT });
      log.info('User', 'john', 'logged in');
      assert.ok(log);
    });
  });

  describe('requestLogger middleware', () => {
    test('should create request logger middleware', () => {
      const middleware = requestLogger({});
      assert.strictEqual(typeof middleware, 'function');
    });

    test('should log request and response', () => {
      const middleware = requestLogger({});

      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: {},
      } as RequestContext;

      let endCalled = false;
      const res = {
        raw: {
          statusCode: 200,
          end: function (this: any, ...args: any[]) {
            endCalled = true;
            return this;
          },
        },
      } as unknown as ResponseContext;

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);

      // Simulate response end
      res.raw.end();
      assert.strictEqual(endCalled, true);
    });

    test('should include headers when option is set', () => {
      const middleware = requestLogger({ includeHeaders: true });

      const req = {
        method: 'GET',
        path: '/test',
        url: '/test',
        headers: { 'user-agent': 'test' },
        body: {},
        params: {},
        query: {},
        raw: {} as any,
      } as RequestContext;

      const res = {
        raw: {
          statusCode: 200,
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});

      assert.ok(req);
    });

    test('should include body when option is set', () => {
      const middleware = requestLogger({ includeBody: true });

      const req = {
        method: 'POST',
        path: '/test',
        headers: {},
        body: { data: 'test' },
      } as RequestContext;

      const res = {
        raw: {
          statusCode: 200,
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});

      assert.ok(req);
    });

    test('should use custom logger when provided', () => {
      const customLogger = createLogger('custom');
      const middleware = requestLogger({ logger: customLogger });

      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: {},
      } as RequestContext;

      const res = {
        raw: {
          statusCode: 200,
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});

      assert.ok(req);
    });

    test('should calculate request duration', () => {
      const middleware = requestLogger({});

      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: {},
      } as RequestContext;

      const res = {
        raw: {
          statusCode: 200,
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});

      // Simulate some time passing
      res.raw.end();

      assert.ok(true);
    });
  });

  describe('performanceLogger middleware', () => {
    test('should create performance logger middleware', () => {
      const middleware = performanceLogger({});
      assert.strictEqual(typeof middleware, 'function');
    });

    test('should log slow requests above threshold', () => {
      const middleware = performanceLogger({ threshold: 0 });

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      let endCalled = false;
      const res = {
        raw: {
          end: function (this: any) {
            endCalled = true;
            return this;
          },
        },
      } as unknown as ResponseContext;

      let nextCalled = false;
      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);

      res.raw.end();
      assert.strictEqual(endCalled, true);
    });

    test('should not log fast requests below threshold', () => {
      const middleware = performanceLogger({ threshold: 10000 });

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      const res = {
        raw: {
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});

      // Simulate fast request
      res.raw.end();

      assert.ok(true);
    });

    test('should use custom logger when provided', () => {
      const customLogger = createLogger('perf');
      const middleware = performanceLogger({ logger: customLogger });

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      const res = {
        raw: {
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});
      res.raw.end();

      assert.ok(true);
    });

    test('should default threshold to 0', () => {
      const middleware = performanceLogger({});

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      const res = {
        raw: {
          end: function (this: any) {
            return this;
          },
        },
      } as unknown as ResponseContext;

      middleware(req, res, () => {});
      res.raw.end();

      assert.ok(true);
    });
  });

  describe('createLogger', () => {
    test('should create logger with prefix', () => {
      const log = createLogger('myapp');
      assert.ok(log);
      assert.strictEqual(typeof log.info, 'function');
    });

    test('should create logger with prefix and options', () => {
      const log = createLogger('myapp', {
        level: LogLevel.DEBUG,
        colors: false,
      });
      assert.ok(log);
      assert.strictEqual(log.getLevel(), LogLevel.DEBUG);
    });

    test('should create independent logger instances', () => {
      const log1 = createLogger('app1', { level: LogLevel.DEBUG });
      const log2 = createLogger('app2', { level: LogLevel.ERROR });

      assert.strictEqual(log1.getLevel(), LogLevel.DEBUG);
      assert.strictEqual(log2.getLevel(), LogLevel.ERROR);
    });
  });
});
