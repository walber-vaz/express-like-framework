/**
 * Tests for MiddlewareChain and middleware utilities
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  compose,
  conditional,
  createMiddleware,
  MiddlewareChain,
  onlyMethods,
  onlyPaths,
} from '../../dist/core/middleware.js';
import { Request } from '../../dist/core/request.js';
import { Response } from '../../dist/core/response.js';
import type { Middleware, NextFunction } from '../../dist/utils/types.js';
import { createMockRequest, createMockResponse } from '../helpers/mock-http.js';
import { createSpy } from '../helpers/test-utils.js';

describe('MiddlewareChain', () => {
  test('should create empty chain', () => {
    const chain = new MiddlewareChain();
    assert.strictEqual(chain.length, 0);
  });

  test('should add middleware with use()', () => {
    const chain = new MiddlewareChain();
    const middleware = createSpy<Middleware>();

    chain.use(middleware);

    assert.strictEqual(chain.length, 1);
  });

  test('should add multiple middlewares with useMany()', () => {
    const chain = new MiddlewareChain();
    const middleware1 = createSpy<Middleware>();
    const middleware2 = createSpy<Middleware>();
    const middleware3 = createSpy<Middleware>();

    chain.useMany([middleware1, middleware2, middleware3]);

    assert.strictEqual(chain.length, 3);
  });

  test('should support method chaining', () => {
    const chain = new MiddlewareChain();
    const middleware1 = createSpy<Middleware>();
    const middleware2 = createSpy<Middleware>();

    const result = chain.use(middleware1).use(middleware2);

    assert.strictEqual(result, chain);
    assert.strictEqual(chain.length, 2);
  });

  test('should execute middlewares in order', async () => {
    const chain = new MiddlewareChain();
    const executionOrder: number[] = [];

    const middleware1: Middleware = async (req, res, next) => {
      executionOrder.push(1);
      next();
    };

    const middleware2: Middleware = async (req, res, next) => {
      executionOrder.push(2);
      next();
    };

    const middleware3: Middleware = async (req, res, next) => {
      executionOrder.push(3);
      next();
    };

    chain.use(middleware1).use(middleware2).use(middleware3);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    await chain.execute(req, res);

    assert.deepStrictEqual(executionOrder, [1, 2, 3]);
  });

  test('should stop execution if next() is not called', async () => {
    const chain = new MiddlewareChain();
    const middleware1Spy = createSpy<Middleware>();
    const middleware2Spy = createSpy<Middleware>();
    const middleware3Spy = createSpy<Middleware>();

    const middleware1: Middleware = async (req, res, next) => {
      middleware1Spy(req, res, next);
      next(); // Call next
    };

    const middleware2: Middleware = async (req, res, next) => {
      middleware2Spy(req, res, next);
      // Don't call next - should stop here
    };

    const middleware3: Middleware = async (req, res, next) => {
      middleware3Spy(req, res, next);
      next();
    };

    chain.use(middleware1).use(middleware2).use(middleware3);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    await chain.execute(req, res);

    // Middleware 1 and 2 should be called
    assert.strictEqual(middleware1Spy.callCount, 1);
    assert.strictEqual(middleware2Spy.callCount, 1);

    // Middleware 3 should NOT be called
    assert.strictEqual(middleware3Spy.callCount, 0);
  });

  test('should propagate errors thrown in middleware', async () => {
    const chain = new MiddlewareChain();
    const testError = new Error('Test error');

    const middleware1: Middleware = async (req, res, next) => {
      throw testError;
    };

    const middleware2Spy = createSpy<Middleware>();

    chain.use(middleware1).use(middleware2Spy);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    await assert.rejects(
      async () => await chain.execute(req, res),
      (error: Error) => {
        assert.strictEqual(error, testError);
        return true;
      },
    );

    // Second middleware should not be called
    assert.strictEqual(middleware2Spy.callCount, 0);
  });

  test('should propagate errors passed to next()', async () => {
    const chain = new MiddlewareChain();
    const testError = new Error('Test error');

    const middleware1: Middleware = async (req, res, next) => {
      next(testError);
    };

    const middleware2Spy = createSpy<Middleware>();

    chain.use(middleware1).use(middleware2Spy);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    await assert.rejects(
      async () => await chain.execute(req, res),
      (error: Error) => {
        assert.strictEqual(error, testError);
        return true;
      },
    );

    // Second middleware should not be called
    assert.strictEqual(middleware2Spy.callCount, 0);
  });

  test('should handle async middleware', async () => {
    const chain = new MiddlewareChain();
    const executionOrder: string[] = [];

    const middleware1: Middleware = async (req, res, next) => {
      executionOrder.push('start-1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push('end-1');
      next();
    };

    const middleware2: Middleware = async (req, res, next) => {
      executionOrder.push('start-2');
      await new Promise((resolve) => setTimeout(resolve, 5));
      executionOrder.push('end-2');
      next();
    };

    chain.use(middleware1).use(middleware2);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    await chain.execute(req, res);

    assert.deepStrictEqual(executionOrder, [
      'start-1',
      'end-1',
      'start-2',
      'end-2',
    ]);
  });

  test('should clear all middlewares', () => {
    const chain = new MiddlewareChain();
    const middleware1 = createSpy<Middleware>();
    const middleware2 = createSpy<Middleware>();

    chain.use(middleware1).use(middleware2);
    assert.strictEqual(chain.length, 2);

    chain.clear();
    assert.strictEqual(chain.length, 0);
  });

  test('should handle empty chain execution', async () => {
    const chain = new MiddlewareChain();

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    // Should not throw
    await chain.execute(req, res);
  });
});

describe('compose', () => {
  test('should compose multiple middlewares into one', async () => {
    const executionOrder: number[] = [];

    const middleware1: Middleware = async (req, res, next) => {
      executionOrder.push(1);
      next();
    };

    const middleware2: Middleware = async (req, res, next) => {
      executionOrder.push(2);
      next();
    };

    const middleware3: Middleware = async (req, res, next) => {
      executionOrder.push(3);
      next();
    };

    const composed = compose(middleware1, middleware2, middleware3);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await composed(req, res, nextSpy);

    assert.deepStrictEqual(executionOrder, [1, 2, 3]);
    assert.strictEqual(nextSpy.callCount, 1);
  });

  test('should call outer next after all composed middlewares', async () => {
    const middleware1: Middleware = async (req, res, next) => {
      next();
    };

    const middleware2: Middleware = async (req, res, next) => {
      next();
    };

    const composed = compose(middleware1, middleware2);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await composed(req, res, nextSpy);

    assert.strictEqual(nextSpy.callCount, 1);
  });

  test('should handle empty compose', async () => {
    const composed = compose();

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await composed(req, res, nextSpy);

    // Should call next immediately
    assert.strictEqual(nextSpy.callCount, 1);
  });
});

describe('createMiddleware', () => {
  test('should create middleware from simple function', async () => {
    const fnSpy = createSpy<(req: any, res: any) => void>();
    const middleware = createMiddleware(fnSpy);

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await middleware(req, res, nextSpy);

    assert.strictEqual(fnSpy.callCount, 1);
    assert.strictEqual(nextSpy.callCount, 1);
  });

  test('should call next automatically after function execution', async () => {
    let executed = false;

    const middleware = createMiddleware(async (req, res) => {
      executed = true;
    });

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await middleware(req, res, nextSpy);

    assert.strictEqual(executed, true);
    assert.strictEqual(nextSpy.callCount, 1);
  });

  test('should handle async functions', async () => {
    const executionOrder: string[] = [];

    const middleware = createMiddleware(async (req, res) => {
      executionOrder.push('start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push('end');
    });

    const mockReq = createMockRequest();
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await middleware(req, res, nextSpy);

    assert.deepStrictEqual(executionOrder, ['start', 'end']);
    assert.strictEqual(nextSpy.callCount, 1);
  });
});

describe('conditional', () => {
  test('should execute middleware when condition is true', async () => {
    const middlewareSpy = createSpy<Middleware>();

    const conditionalMiddleware = conditional(
      (req) => req.method === 'GET',
      middlewareSpy,
    );

    const mockReq = createMockRequest({ method: 'GET' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await conditionalMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 1);
  });

  test('should skip middleware when condition is false', async () => {
    const middlewareSpy = createSpy<Middleware>();

    const conditionalMiddleware = conditional(
      (req) => req.method === 'POST',
      middlewareSpy,
    );

    const mockReq = createMockRequest({ method: 'GET' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await conditionalMiddleware(req, res, nextSpy);

    // Middleware should not be called
    assert.strictEqual(middlewareSpy.callCount, 0);
    // But next should be called
    assert.strictEqual(nextSpy.callCount, 1);
  });
});

describe('onlyMethods', () => {
  test('should execute middleware for matching method', async () => {
    const middlewareSpy = createSpy<Middleware>((req, res, next) => next());

    const methodMiddleware = onlyMethods(['GET', 'POST'], middlewareSpy);

    const mockReq = createMockRequest({ method: 'GET' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await methodMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 1);
  });

  test('should skip middleware for non-matching method', async () => {
    const middlewareSpy = createSpy<Middleware>();

    const methodMiddleware = onlyMethods(['GET', 'POST'], middlewareSpy);

    const mockReq = createMockRequest({ method: 'DELETE' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await methodMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 0);
    assert.strictEqual(nextSpy.callCount, 1);
  });

  test('should handle case-insensitive methods', async () => {
    const middlewareSpy = createSpy<Middleware>((req, res, next) => next());

    const methodMiddleware = onlyMethods(['get', 'post'], middlewareSpy);

    const mockReq = createMockRequest({ method: 'GET' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await methodMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 1);
  });
});

describe('onlyPaths', () => {
  test('should execute middleware for matching path (string)', async () => {
    const middlewareSpy = createSpy<Middleware>((req, res, next) => next());

    const pathMiddleware = onlyPaths('/api', middlewareSpy);

    const mockReq = createMockRequest({ url: '/api/users' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await pathMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 1);
  });

  test('should skip middleware for non-matching path (string)', async () => {
    const middlewareSpy = createSpy<Middleware>();

    const pathMiddleware = onlyPaths('/api', middlewareSpy);

    const mockReq = createMockRequest({ url: '/admin/users' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await pathMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 0);
    assert.strictEqual(nextSpy.callCount, 1);
  });

  test('should execute middleware for matching path (regex)', async () => {
    const middlewareSpy = createSpy<Middleware>((req, res, next) => next());

    const pathMiddleware = onlyPaths(/^\/api\/.*/, middlewareSpy);

    const mockReq = createMockRequest({ url: '/api/users/123' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await pathMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 1);
  });

  test('should skip middleware for non-matching path (regex)', async () => {
    const middlewareSpy = createSpy<Middleware>();

    const pathMiddleware = onlyPaths(/^\/api\/.*/, middlewareSpy);

    const mockReq = createMockRequest({ url: '/admin/users' });
    const mockRes = createMockResponse();
    const req = new Request(mockReq);
    const res = new Response(mockRes);

    const nextSpy = createSpy<NextFunction>();
    await pathMiddleware(req, res, nextSpy);

    assert.strictEqual(middlewareSpy.callCount, 0);
    assert.strictEqual(nextSpy.callCount, 1);
  });
});
