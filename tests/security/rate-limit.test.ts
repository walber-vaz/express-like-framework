import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  rateLimit,
  rateLimitPresets,
  rateLimitByUser,
  rateLimitByRoute,
  MemoryStore,
  type RateLimitStore,
  type RateLimitInfo,
} from '../../src/security/rate-limit.js';
import { Request } from '../../src/core/request.js';
import { Response } from '../../src/core/response.js';
import { createMockRequest, createMockResponse } from '../helpers/mock-http.js';
import { HttpStatus } from '../../src/utils/types.js';
import { sleep } from '../helpers/test-utils.js';

describe('Rate Limit', () => {
  describe('rateLimit() middleware', () => {
    test('should allow requests under the limit', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = rateLimit({ max: 5, windowMs: 60000 });
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['ratelimit-limit'], '5');
      assert.strictEqual(res.headers['ratelimit-remaining'], '4');
      assert.ok(res.headers['ratelimit-reset']);
    });

    test('should block requests over the limit', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimit({ max: 2, windowMs: 60000, store });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // Request 1 - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);
      assert.strictEqual(res.headers['ratelimit-remaining'], '1');

      // Request 2 - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);
      assert.strictEqual(res.headers['ratelimit-remaining'], '0');

      // Request 3 - should be blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);
      assert.strictEqual((errorThrown as any).statusCode, HttpStatus.TOO_MANY_REQUESTS);
      assert.strictEqual(errorThrown.message, 'Too many requests, please try again later.');
      assert.ok(res.headers['retry-after']);

      store.shutdown();
    });

    test('should use custom message and status code', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const customMessage = 'Slow down!';
      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        message: customMessage,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        store,
      });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // First request - passes
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Second request - blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);
      assert.strictEqual((errorThrown as any).statusCode, HttpStatus.SERVICE_UNAVAILABLE);
      assert.strictEqual(errorThrown.message, customMessage);

      store.shutdown();
    });

    test('should reset counter after window expires', async () => {
      const store = new MemoryStore();
      const windowMs = 100; // 100ms window for testing
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimit({ max: 2, windowMs, store });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // Request 1 - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Request 2 - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Request 3 - should be blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);

      // Wait for window to expire
      await sleep(windowMs + 50);
      errorThrown = undefined;

      // Request 4 - should pass (new window)
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);
      assert.strictEqual(res.headers['ratelimit-remaining'], '1');

      store.shutdown();
    });

    test('should use custom key generator', async () => {
      const store = new MemoryStore();
      const mockReq1 = createMockRequest({
        method: 'GET',
        url: '/',
        headers: { 'x-api-key': 'key-1' },
      });
      const mockReq2 = createMockRequest({
        method: 'GET',
        url: '/',
        headers: { 'x-api-key': 'key-2' },
      });
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const req1 = new Request(mockReq1);
      const req2 = new Request(mockReq2);
      const res1 = new Response(mockRes1);
      const res2 = new Response(mockRes2);

      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator: (req) => {
          const apiKey = req.headers['x-api-key'];
          return Array.isArray(apiKey) ? apiKey[0] : apiKey || 'default';
        },
        store,
      });

      let error1: Error | undefined;
      let error2: Error | undefined;
      const next1 = (error?: Error) => {
        if (error) error1 = error;
      };
      const next2 = (error?: Error) => {
        if (error) error2 = error;
      };

      // Request with key-1 - should pass
      await middleware(req1, res1, next1);
      assert.strictEqual(error1, undefined);

      // Second request with key-1 - should be blocked
      await middleware(req1, res1, next1);
      assert.ok(error1);

      // Request with key-2 - should pass (different key)
      await middleware(req2, res2, next2);
      assert.strictEqual(error2, undefined);

      store.shutdown();
    });

    test('should skip rate limiting when skip function returns true', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({
        method: 'GET',
        url: '/',
        headers: { 'x-skip': 'true' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        skip: (req) => req.headers['x-skip'] === 'true',
        store,
      });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // Multiple requests should all pass because of skip
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      store.shutdown();
    });

    test('should call custom handler when limit exceeded', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let handlerCalled = false;
      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        handler: () => {
          handlerCalled = true;
        },
        store,
      });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // First request - passes
      await middleware(req, res, next);
      assert.strictEqual(handlerCalled, false);

      // Second request - blocked, handler called
      await middleware(req, res, next);
      assert.strictEqual(handlerCalled, true);
      assert.ok(errorThrown);

      store.shutdown();
    });

    test('should set legacy headers when enabled', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = rateLimit({
        max: 5,
        windowMs: 60000,
        legacyHeaders: true,
      });
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-ratelimit-limit'], '5');
      assert.strictEqual(res.headers['x-ratelimit-remaining'], '4');
      assert.ok(res.headers['x-ratelimit-reset']);
    });

    test('should not set standard headers when disabled', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = rateLimit({
        max: 5,
        windowMs: 60000,
        standardHeaders: false,
      });
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['ratelimit-limit'], undefined);
      assert.strictEqual(res.headers['ratelimit-remaining'], undefined);
      assert.strictEqual(res.headers['ratelimit-reset'], undefined);
    });

    test('should use IP from x-forwarded-for header', async () => {
      const store = new MemoryStore();
      const mockReq1 = createMockRequest({
        method: 'GET',
        url: '/',
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      const mockReq2 = createMockRequest({
        method: 'GET',
        url: '/',
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const req1 = new Request(mockReq1);
      const req2 = new Request(mockReq2);
      const res1 = new Response(mockRes1);
      const res2 = new Response(mockRes2);

      const middleware = rateLimit({ max: 1, windowMs: 60000, store });

      let error1: Error | undefined;
      let error2: Error | undefined;
      const next1 = (error?: Error) => {
        if (error) error1 = error;
      };
      const next2 = (error?: Error) => {
        if (error) error2 = error;
      };

      // Request from IP 192.168.1.1 - should pass
      await middleware(req1, res1, next1);
      assert.strictEqual(error1, undefined);

      // Second request from same IP - should be blocked
      await middleware(req1, res1, next1);
      assert.ok(error1);

      // Request from different IP - should pass
      await middleware(req2, res2, next2);
      assert.strictEqual(error2, undefined);

      store.shutdown();
    });

    test('should use IP from x-real-ip header', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({
        method: 'GET',
        url: '/',
        headers: { 'x-real-ip': '192.168.1.100' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimit({ max: 1, windowMs: 60000, store });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // First request - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Second request from same IP - should be blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);

      store.shutdown();
    });
  });

  describe('MemoryStore', () => {
    test('should increment count for new key', async () => {
      const store = new MemoryStore();
      const result = await store.increment('test-key', 60000);

      assert.strictEqual(result.count, 1);
      assert.ok(result.resetTime > Date.now());
      assert.ok(result.resetTime <= Date.now() + 60000);

      store.shutdown();
    });

    test('should increment count for existing key', async () => {
      const store = new MemoryStore();

      const result1 = await store.increment('test-key', 60000);
      assert.strictEqual(result1.count, 1);

      const result2 = await store.increment('test-key', 60000);
      assert.strictEqual(result2.count, 2);
      assert.strictEqual(result2.resetTime, result1.resetTime);

      store.shutdown();
    });

    test('should reset count after window expires', async () => {
      const store = new MemoryStore();
      const windowMs = 100;

      const result1 = await store.increment('test-key', windowMs);
      assert.strictEqual(result1.count, 1);

      // Wait for window to expire
      await sleep(windowMs + 50);

      const result2 = await store.increment('test-key', windowMs);
      assert.strictEqual(result2.count, 1); // Reset to 1
      assert.ok(result2.resetTime > result1.resetTime);

      store.shutdown();
    });

    test('should clean up expired entries', async () => {
      const cleanupInterval = 100;
      const store = new MemoryStore(cleanupInterval);
      const windowMs = 50;

      // Create some entries
      await store.increment('key1', windowMs);
      await store.increment('key2', windowMs);

      // Wait for entries to expire and cleanup to run
      await sleep(windowMs + cleanupInterval + 50);

      // After cleanup, these should be new entries (count = 1)
      const result1 = await store.increment('key1', windowMs);
      const result2 = await store.increment('key2', windowMs);

      assert.strictEqual(result1.count, 1);
      assert.strictEqual(result2.count, 1);

      store.shutdown();
    });

    test('should handle multiple keys independently', async () => {
      const store = new MemoryStore();
      const windowMs = 60000;

      const result1 = await store.increment('key1', windowMs);
      const result2 = await store.increment('key2', windowMs);
      const result3 = await store.increment('key1', windowMs);

      assert.strictEqual(result1.count, 1);
      assert.strictEqual(result2.count, 1);
      assert.strictEqual(result3.count, 2);

      store.shutdown();
    });
  });

  describe('rateLimitPresets', () => {
    test('strict preset should have low limit', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = rateLimitPresets.strict();
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['ratelimit-limit'], '20');
      assert.strictEqual(res.headers['ratelimit-remaining'], '19');
    });

    test('moderate preset should have medium limit', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = rateLimitPresets.moderate();
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['ratelimit-limit'], '100');
      assert.strictEqual(res.headers['ratelimit-remaining'], '99');
    });

    test('relaxed preset should have high limit', async () => {
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = rateLimitPresets.relaxed();
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['ratelimit-limit'], '1000');
      assert.strictEqual(res.headers['ratelimit-remaining'], '999');
    });

    test('auth preset should have very low limit and custom message', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({ method: 'POST', url: '/login' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimitPresets.auth();
      // Override store to control test
      (middleware as any).store = store;

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await middleware(req, res, next);
      }
      assert.strictEqual(errorThrown, undefined);

      // 6th request should be blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);
      assert.ok(errorThrown.message.includes('authentication'));

      store.shutdown();
    });

    test('create preset should have low limit and custom message', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({ method: 'POST', url: '/create' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimitPresets.create();
      // Override store to control test
      (middleware as any).store = store;

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await middleware(req, res, next);
      }
      assert.strictEqual(errorThrown, undefined);

      // 11th request should be blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);
      assert.ok(errorThrown.message.includes('create'));

      store.shutdown();
    });
  });

  describe('rateLimitByUser', () => {
    test('should use user ID as key', async () => {
      const store = new MemoryStore();
      const mockReq1 = createMockRequest({ method: 'GET', url: '/' });
      const mockReq2 = createMockRequest({ method: 'GET', url: '/' });
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const req1 = new Request(mockReq1) as any;
      const req2 = new Request(mockReq2) as any;
      const res1 = new Response(mockRes1);
      const res2 = new Response(mockRes2);

      // Simulate authenticated users
      req1.user = { id: 'user-1' };
      req2.user = { id: 'user-2' };

      const middleware = rateLimitByUser({ max: 1, windowMs: 60000, store });

      let error1: Error | undefined;
      let error2: Error | undefined;
      const next1 = (error?: Error) => {
        if (error) error1 = error;
      };
      const next2 = (error?: Error) => {
        if (error) error2 = error;
      };

      // Request from user-1 - should pass
      await middleware(req1, res1, next1);
      assert.strictEqual(error1, undefined);

      // Second request from user-1 - should be blocked
      await middleware(req1, res1, next1);
      assert.ok(error1);

      // Request from user-2 - should pass (different user)
      await middleware(req2, res2, next2);
      assert.strictEqual(error2, undefined);

      store.shutdown();
    });

    test('should fallback to IP when no user', async () => {
      const store = new MemoryStore();
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimitByUser({ max: 1, windowMs: 60000, store });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // First request - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Second request - should be blocked (same IP)
      await middleware(req, res, next);
      assert.ok(errorThrown);

      store.shutdown();
    });
  });

  describe('rateLimitByRoute', () => {
    test('should use IP + route as key', async () => {
      const store = new MemoryStore();
      const mockReq1 = createMockRequest({ method: 'GET', url: '/route1' });
      const mockReq2 = createMockRequest({ method: 'GET', url: '/route2' });
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const req1 = new Request(mockReq1);
      const req2 = new Request(mockReq2);
      const res1 = new Response(mockRes1);
      const res2 = new Response(mockRes2);

      const middleware = rateLimitByRoute({ max: 1, windowMs: 60000, store });

      let error1: Error | undefined;
      let error2: Error | undefined;
      const next1 = (error?: Error) => {
        if (error) error1 = error;
      };
      const next2 = (error?: Error) => {
        if (error) error2 = error;
      };

      // Request to /route1 - should pass
      await middleware(req1, res1, next1);
      assert.strictEqual(error1, undefined);

      // Second request to /route1 - should be blocked
      await middleware(req1, res1, next1);
      assert.ok(error1);

      // Request to /route2 - should pass (different route)
      await middleware(req2, res2, next2);
      assert.strictEqual(error2, undefined);

      store.shutdown();
    });

    test('should track same IP on different routes separately', async () => {
      const store = new MemoryStore();
      const mockReq1 = createMockRequest({
        method: 'GET',
        url: '/api/users',
        socket: { remoteAddress: '192.168.1.1' },
      });
      const mockReq2 = createMockRequest({
        method: 'GET',
        url: '/api/posts',
        socket: { remoteAddress: '192.168.1.1' },
      });
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const req1 = new Request(mockReq1);
      const req2 = new Request(mockReq2);
      const res1 = new Response(mockRes1);
      const res2 = new Response(mockRes2);

      const middleware = rateLimitByRoute({ max: 1, windowMs: 60000, store });

      let error1: Error | undefined;
      let error2: Error | undefined;
      const next1 = (error?: Error) => {
        if (error) error1 = error;
      };
      const next2 = (error?: Error) => {
        if (error) error2 = error;
      };

      // Request to /api/users - should pass
      await middleware(req1, res1, next1);
      assert.strictEqual(error1, undefined);

      // Request to /api/posts from same IP - should pass (different route)
      await middleware(req2, res2, next2);
      assert.strictEqual(error2, undefined);

      // Second request to /api/users - should be blocked
      await middleware(req1, res1, next1);
      assert.ok(error1);

      // Second request to /api/posts - should be blocked
      await middleware(req2, res2, next2);
      assert.ok(error2);

      store.shutdown();
    });
  });

  describe('Custom RateLimitStore', () => {
    test('should work with custom store implementation', async () => {
      // Simple custom store implementation
      class CustomStore implements RateLimitStore {
        private data: Map<string, RateLimitInfo> = new Map();

        async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
          const now = Date.now();
          let record = this.data.get(key);

          if (!record || now > record.resetTime) {
            record = {
              count: 1,
              resetTime: now + windowMs,
            };
          } else {
            record.count++;
          }

          this.data.set(key, record);
          return record;
        }

        // Test helper
        clear() {
          this.data.clear();
        }
      }

      const customStore = new CustomStore();
      const mockReq = createMockRequest({ method: 'GET', url: '/' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      const middleware = rateLimit({ max: 2, windowMs: 60000, store: customStore });

      let errorThrown: Error | undefined;
      const next = (error?: Error) => {
        if (error) errorThrown = error;
      };

      // Request 1 - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Request 2 - should pass
      await middleware(req, res, next);
      assert.strictEqual(errorThrown, undefined);

      // Request 3 - should be blocked
      await middleware(req, res, next);
      assert.ok(errorThrown);
    });
  });
});
