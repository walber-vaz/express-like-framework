import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  context,
  performanceMiddleware,
  requestIdMiddleware,
} from '../../src/core/context.js';
import { Request } from '../../src/core/request.js';
import { Response } from '../../src/core/response.js';
import type { RequestContext, ResponseContext } from '../../src/utils/types.js';
import { createMockRequest, createMockResponse } from '../helpers/mock-http.js';
import { sleep } from '../helpers/test-utils.js';

describe('Context', () => {
  describe('run() and context execution', () => {
    test('should execute function within context', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let executed = false;

      await context.run(req, res, async () => {
        executed = true;
      });

      assert.strictEqual(executed, true);
    });

    test('should create unique request ID', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let requestId: string | undefined;

      await context.run(req, res, async () => {
        requestId = context.getRequestId();
      });

      assert.ok(requestId);
      assert.strictEqual(typeof requestId, 'string');
      assert.ok(requestId.length > 0);
    });

    test('should generate different IDs for different contexts', async () => {
      const mockReq1 = createMockRequest({ method: 'GET', url: '/test1' });
      const mockRes1 = createMockResponse();
      const req1 = new Request(mockReq1);
      const res1 = new Response(mockRes1);

      const mockReq2 = createMockRequest({ method: 'GET', url: '/test2' });
      const mockRes2 = createMockResponse();
      const req2 = new Request(mockReq2);
      const res2 = new Response(mockRes2);

      let id1: string | undefined;
      let id2: string | undefined;

      await context.run(req1, res1, async () => {
        id1 = context.getRequestId();
      });

      await context.run(req2, res2, async () => {
        id2 = context.getRequestId();
      });

      assert.ok(id1);
      assert.ok(id2);
      assert.notStrictEqual(id1, id2);
    });

    test('should handle async operations within context', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let value: string | undefined;

      await context.run(req, res, async () => {
        await sleep(10);
        value = 'async-value';
      });

      assert.strictEqual(value, 'async-value');
    });
  });

  describe('getRequest() and getResponse()', () => {
    test('should return request from context', async () => {
      const mockReq = createMockRequest({ method: 'POST', url: '/api/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let retrievedReq: RequestContext | undefined;

      await context.run(req, res, async () => {
        retrievedReq = context.getRequest();
      });

      assert.ok(retrievedReq);
      assert.strictEqual(retrievedReq.method, 'POST');
      assert.strictEqual(retrievedReq.path, '/api/test');
    });

    test('should return response from context', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let retrievedRes: ResponseContext | undefined;

      await context.run(req, res, async () => {
        retrievedRes = context.getResponse();
      });

      assert.ok(retrievedRes);
      assert.strictEqual(typeof retrievedRes.status, 'function');
      assert.strictEqual(typeof retrievedRes.json, 'function');
    });

    test('should return undefined when outside context', () => {
      const req = context.getRequest();
      const res = context.getResponse();
      const id = context.getRequestId();

      assert.strictEqual(req, undefined);
      assert.strictEqual(res, undefined);
      assert.strictEqual(id, undefined);
    });

    test('should maintain context in nested async calls', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const nestedAsyncFunction = async () => {
        await sleep(5);
        return context.getRequest();
      };

      let nestedReq: RequestContext | undefined;

      await context.run(req, res, async () => {
        nestedReq = await nestedAsyncFunction();
      });

      assert.ok(nestedReq);
      assert.strictEqual(nestedReq.method, 'GET');
    });
  });

  describe('getElapsedTime()', () => {
    test('should return elapsed time in milliseconds', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let elapsed: number | undefined;

      await context.run(req, res, async () => {
        await sleep(10);
        elapsed = context.getElapsedTime();
      });

      assert.ok(elapsed !== undefined);
      assert.ok(elapsed >= 10); // Should be at least 10ms
      assert.ok(elapsed < 100); // But not too long
    });

    test('should return undefined outside context', () => {
      const elapsed = context.getElapsedTime();

      assert.strictEqual(elapsed, undefined);
    });

    test('should increase over time', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let elapsed1: number | undefined;
      let elapsed2: number | undefined;

      await context.run(req, res, async () => {
        await sleep(5);
        elapsed1 = context.getElapsedTime();

        await sleep(5);
        elapsed2 = context.getElapsedTime();
      });

      assert.ok(elapsed1 !== undefined);
      assert.ok(elapsed2 !== undefined);
      assert.ok(elapsed2 > elapsed1);
    });
  });

  describe('Metadata (set/get)', () => {
    test('should set and get metadata', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let retrievedValue: string | undefined;

      await context.run(req, res, async () => {
        context.set('userId', 'user-123');
        retrievedValue = context.get<string>('userId');
      });

      assert.strictEqual(retrievedValue, 'user-123');
    });

    test('should handle different data types', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await context.run(req, res, async () => {
        context.set('string', 'value');
        context.set('number', 42);
        context.set('boolean', true);
        context.set('object', { key: 'value' });
        context.set('array', [1, 2, 3]);

        assert.strictEqual(context.get<string>('string'), 'value');
        assert.strictEqual(context.get<number>('number'), 42);
        assert.strictEqual(context.get<boolean>('boolean'), true);
        assert.deepStrictEqual(context.get<{ key: string }>('object'), {
          key: 'value',
        });
        assert.deepStrictEqual(context.get<number[]>('array'), [1, 2, 3]);
      });
    });

    test('should return undefined for non-existent keys', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let value: string | undefined;

      await context.run(req, res, async () => {
        value = context.get<string>('non-existent');
      });

      assert.strictEqual(value, undefined);
    });

    test('should not leak metadata between contexts', async () => {
      const mockReq1 = createMockRequest({ method: 'GET', url: '/test1' });
      const mockRes1 = createMockResponse();
      const req1 = new Request(mockReq1);
      const res1 = new Response(mockRes1);

      const mockReq2 = createMockRequest({ method: 'GET', url: '/test2' });
      const mockRes2 = createMockResponse();
      const req2 = new Request(mockReq2);
      const res2 = new Response(mockRes2);

      let value1: string | undefined;
      let value2: string | undefined;

      await context.run(req1, res1, async () => {
        context.set('userId', 'user-1');
        value1 = context.get<string>('userId');
      });

      await context.run(req2, res2, async () => {
        value2 = context.get<string>('userId');
      });

      assert.strictEqual(value1, 'user-1');
      assert.strictEqual(value2, undefined);
    });

    test('should not set metadata outside context', () => {
      // Should not throw, but won't set anything
      context.set('key', 'value');
      const value = context.get<string>('key');

      assert.strictEqual(value, undefined);
    });
  });

  describe('hasContext()', () => {
    test('should return true inside context', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let hasCtx = false;

      await context.run(req, res, async () => {
        hasCtx = context.hasContext();
      });

      assert.strictEqual(hasCtx, true);
    });

    test('should return false outside context', () => {
      const hasCtx = context.hasContext();

      assert.strictEqual(hasCtx, false);
    });

    test('should work in nested async calls', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const nestedCheck = async () => {
        await sleep(5);
        return context.hasContext();
      };

      let nestedHasCtx = false;

      await context.run(req, res, async () => {
        nestedHasCtx = await nestedCheck();
      });

      assert.strictEqual(nestedHasCtx, true);
    });
  });

  describe('getStore()', () => {
    test('should return complete store inside context', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let store: any;

      await context.run(req, res, async () => {
        store = context.getStore();
      });

      assert.ok(store);
      assert.ok(store.id);
      assert.ok(store.req);
      assert.ok(store.res);
      assert.ok(typeof store.startTime === 'number');
      assert.ok(store.metadata instanceof Map);
    });

    test('should return undefined outside context', () => {
      const store = context.getStore();

      assert.strictEqual(store, undefined);
    });
  });

  describe('requestIdMiddleware', () => {
    test('should add x-request-id header', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await context.run(req, res, async () => {
        const middleware = requestIdMiddleware();
        let nextCalled = false;

        middleware(req, res, () => {
          nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
        assert.ok(res.headers['x-request-id']);
        assert.strictEqual(typeof res.headers['x-request-id'], 'string');
      });
    });

    test('should use context request ID', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await context.run(req, res, async () => {
        const contextId = context.getRequestId();
        const middleware = requestIdMiddleware();

        middleware(req, res, () => {});

        assert.strictEqual(res.headers['x-request-id'], contextId);
      });
    });
  });

  describe('performanceMiddleware', () => {
    test('should add x-response-time header', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await context.run(req, res, async () => {
        await sleep(10);

        const middleware = performanceMiddleware();
        let nextCalled = false;

        middleware(req, res, () => {
          nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
        assert.ok(res.headers['x-response-time']);
        assert.ok(
          typeof res.headers['x-response-time'] === 'string' &&
            res.headers['x-response-time'].includes('ms'),
        );
      });
    });

    test('should reflect actual elapsed time', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/test' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await context.run(req, res, async () => {
        await sleep(10);

        const middleware = performanceMiddleware();
        middleware(req, res, () => {});

        const timeHeader = res.headers['x-response-time'] as string;
        const timeMs = Number.parseInt(timeHeader.replace('ms', ''), 10);

        assert.ok(timeMs >= 10);
      });
    });
  });

  describe('Context Isolation', () => {
    test('should maintain separate contexts for concurrent requests', async () => {
      const mockReq1 = createMockRequest({ method: 'GET', url: '/req1' });
      const mockRes1 = createMockResponse();
      const req1 = new Request(mockReq1);
      const res1 = new Response(mockRes1);

      const mockReq2 = createMockRequest({ method: 'GET', url: '/req2' });
      const mockRes2 = createMockResponse();
      const req2 = new Request(mockReq2);
      const res2 = new Response(mockRes2);

      const results: string[] = [];

      const promise1 = context.run(req1, res1, async () => {
        context.set('request', 'req1');
        await sleep(20);
        results.push(context.get<string>('request') || 'missing');
      });

      const promise2 = context.run(req2, res2, async () => {
        context.set('request', 'req2');
        await sleep(10);
        results.push(context.get<string>('request') || 'missing');
      });

      await Promise.all([promise1, promise2]);

      // Each context should maintain its own value
      assert.ok(results.includes('req1'));
      assert.ok(results.includes('req2'));
      assert.strictEqual(results.length, 2);
    });

    test('should not share request objects between contexts', async () => {
      const mockReq1 = createMockRequest({ method: 'GET', url: '/path1' });
      const mockRes1 = createMockResponse();
      const req1 = new Request(mockReq1);
      const res1 = new Response(mockRes1);

      const mockReq2 = createMockRequest({ method: 'POST', url: '/path2' });
      const mockRes2 = createMockResponse();
      const req2 = new Request(mockReq2);
      const res2 = new Response(mockRes2);

      let path1: string | undefined;
      let path2: string | undefined;

      await context.run(req1, res1, async () => {
        path1 = context.getRequest()?.path;
      });

      await context.run(req2, res2, async () => {
        path2 = context.getRequest()?.path;
      });

      assert.strictEqual(path1, '/path1');
      assert.strictEqual(path2, '/path2');
    });
  });
});
