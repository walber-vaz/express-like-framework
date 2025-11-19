import assert from 'node:assert';
import { describe, test } from 'node:test';
import { Request } from '../../src/core/request.js';
import { Response } from '../../src/core/response.js';
import { cors, corsPresets } from '../../src/security/cors.js';
import { createMockRequest, createMockResponse } from '../helpers/mock-http.js';

describe('CORS', () => {
  describe('cors() middleware', () => {
    test('should set wildcard origin by default', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    });

    test('should allow specific origin', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({ origin: 'https://example.com' });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-allow-origin'],
        'https://example.com',
      );
    });

    test('should reject non-matching origin', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://evil.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({ origin: 'https://example.com' });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    });

    test('should allow origin from array', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://app.example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({
        origin: ['https://example.com', 'https://app.example.com'],
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-allow-origin'],
        'https://app.example.com',
      );
    });

    test('should allow origin from regex', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://sub.example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({ origin: /\.example\.com$/ });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-allow-origin'],
        'https://sub.example.com',
      );
    });

    test('should allow origin from function', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://trusted.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({
        origin: (origin) => origin.startsWith('https://trusted'),
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-allow-origin'],
        'https://trusted.com',
      );
    });

    test('should set credentials header', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({
        origin: 'https://example.com',
        credentials: true,
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-allow-credentials'],
        'true',
      );
    });

    test('should set exposed headers', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-expose-headers'],
        'X-Total-Count, X-Page-Count',
      );
    });

    test('should handle OPTIONS preflight request', () => {
      const mockReq = createMockRequest({
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, false); // Should not call next for preflight
      assert.strictEqual(
        res.headers['access-control-allow-methods'],
        'GET, HEAD, PUT, PATCH, POST, DELETE',
      );
      assert.strictEqual(res.headers['access-control-max-age'], '86400');
      assert.ok(mockRes.isFinished());
    });

    test('should echo back requested headers in preflight', () => {
      const mockReq = createMockRequest({
        method: 'OPTIONS',
        headers: {
          origin: 'https://example.com',
          'access-control-request-headers': 'X-Custom-Header, Authorization',
        },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(
        res.headers['access-control-allow-headers'],
        'X-Custom-Header, Authorization',
      );
    });

    test('should use custom allowed headers in preflight', () => {
      const mockReq = createMockRequest({
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({
        allowedHeaders: ['Content-Type', 'Authorization'],
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(
        res.headers['access-control-allow-headers'],
        'Content-Type, Authorization',
      );
    });

    test('should continue after preflight when preflightContinue is true', () => {
      const mockReq = createMockRequest({
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = cors({ preflightContinue: true });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true); // Should call next
    });
  });

  describe('corsPresets', () => {
    test('production preset should restrict origins', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://app.example.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = corsPresets.production([
        'https://example.com',
        'https://app.example.com',
      ]);
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['access-control-allow-origin'],
        'https://app.example.com',
      );
      assert.strictEqual(
        res.headers['access-control-allow-credentials'],
        'true',
      );
    });

    test('publicApi preset should allow all origins without credentials', () => {
      const mockReq = createMockRequest({
        method: 'GET',
        headers: { origin: 'https://anywhere.com' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = corsPresets.publicApi();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
      assert.strictEqual(
        res.headers['access-control-allow-credentials'],
        undefined,
      );
    });
  });
});
