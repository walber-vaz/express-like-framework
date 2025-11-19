import assert from 'node:assert';
import { describe, test } from 'node:test';
import { Request } from '../../src/core/request.js';
import { Response } from '../../src/core/response.js';
import { helmet, helmetPresets } from '../../src/security/helmet.js';
import { createMockRequest, createMockResponse } from '../helpers/mock-http.js';

describe('Helmet', () => {
  describe('helmet() middleware', () => {
    test('should hide x-powered-by header by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      res.headers['x-powered-by'] = 'Express';

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-powered-by'], undefined);
    });

    test('should set x-dns-prefetch-control to off by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-dns-prefetch-control'], 'off');
    });

    test('should set x-frame-options to SAMEORIGIN by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    });

    test('should set x-frame-options to DENY', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet({ frameguard: { action: 'deny' } });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    });

    test('should set strict-transport-security with defaults', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['strict-transport-security'],
        'max-age=15552000; includeSubDomains',
      );
    });

    test('should set strict-transport-security with preload', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet({
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['strict-transport-security'],
        'max-age=31536000; includeSubDomains; preload',
      );
    });

    test('should not set strict-transport-security when disabled', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet({ hsts: false });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['strict-transport-security'], undefined);
    });

    test('should set x-content-type-options to nosniff by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    });

    test('should set referrer-policy to no-referrer by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['referrer-policy'], 'no-referrer');
    });

    test('should set x-xss-protection by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block');
    });

    test('should not set content-security-policy by default', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['content-security-policy'], undefined);
    });

    test('should set content-security-policy with default directives', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet({ contentSecurityPolicy: {} });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.ok(res.headers['content-security-policy']);
      assert.ok(
        res.headers['content-security-policy']?.includes("default-src 'self'"),
      );
      assert.ok(
        res.headers['content-security-policy']?.includes("object-src 'none'"),
      );
    });

    test('should set content-security-policy with custom directives', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmet({
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", 'https://cdn.example.com'],
          },
        },
      });
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(
        res.headers['content-security-policy'],
        "default-src 'self'; script-src 'self' https://cdn.example.com",
      );
    });
  });

  describe('helmetPresets', () => {
    test('default preset should set all security headers', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmetPresets.default();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-dns-prefetch-control'], 'off');
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.ok(res.headers['strict-transport-security']);
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['referrer-policy'], 'no-referrer');
      assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block');
    });

    test('strict preset should set strict security headers', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmetPresets.strict();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['x-frame-options'], 'DENY');
      assert.ok(
        res.headers['strict-transport-security']?.includes('max-age=31536000'),
      );
      assert.ok(res.headers['strict-transport-security']?.includes('preload'));
      assert.ok(res.headers['content-security-policy']);
      assert.ok(
        res.headers['content-security-policy']?.includes(
          "frame-ancestors 'none'",
        ),
      );
    });

    test('development preset should disable CSP and HSTS', () => {
      const mockReq = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = helmetPresets.development();
      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.headers['content-security-policy'], undefined);
      assert.strictEqual(res.headers['strict-transport-security'], undefined);
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN'); // Still set
    });
  });
});
