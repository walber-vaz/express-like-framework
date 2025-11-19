/**
 * Tests for Response wrapper
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';
import { Response } from '../../dist/core/response.js';
import { HttpStatus } from '../../dist/utils/types.js';
import {
  assertBody,
  assertBodyContains,
  assertFinished,
  assertHeader,
  assertJsonBody,
  assertStatusCode,
} from '../helpers/assertions.js';
import { createMockResponse } from '../helpers/mock-http.js';

describe('Response', () => {
  describe('Status and headers', () => {
    test('should create response with default status 200', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      assert.strictEqual(res.statusCode, 200);
    });

    test('should set status code', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const result = res.status(404);

      assert.strictEqual(result, res); // Chainable
      assert.strictEqual(res.statusCode, 404);
    });

    test('should set header', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const result = res.header('Content-Type', 'application/json');

      assert.strictEqual(result, res); // Chainable
      assert.strictEqual(res.getHeader('content-type'), 'application/json');
    });

    test('should normalize header names to lowercase', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.header('Content-Type', 'application/json');
      res.header('X-Custom-Header', 'value');

      assert.strictEqual(res.getHeader('content-type'), 'application/json');
      assert.strictEqual(res.getHeader('x-custom-header'), 'value');
    });

    test('should set multiple headers at once', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const result = res.setHeaders({
        'Content-Type': 'application/json',
        'X-Custom': 'value',
      });

      assert.strictEqual(result, res); // Chainable
      assert.strictEqual(res.getHeader('content-type'), 'application/json');
      assert.strictEqual(res.getHeader('x-custom'), 'value');
    });

    test('should get header value', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.header('Content-Type', 'application/json');

      assert.strictEqual(res.getHeader('content-type'), 'application/json');
      assert.strictEqual(res.getHeader('Content-Type'), 'application/json');
    });

    test('should return undefined for missing header', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      assert.strictEqual(res.getHeader('x-missing'), undefined);
    });

    test('should remove header', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.header('Content-Type', 'application/json');
      assert.strictEqual(res.getHeader('content-type'), 'application/json');

      const result = res.removeHeader('Content-Type');

      assert.strictEqual(result, res); // Chainable
      assert.strictEqual(res.getHeader('content-type'), undefined);
    });

    test('should set content-type with type()', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.type('application/json');

      assert.strictEqual(res.getHeader('content-type'), 'application/json');
    });

    test('should support method chaining', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const result = res
        .status(201)
        .header('X-Custom', 'value')
        .type('application/json');

      assert.strictEqual(result, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.getHeader('x-custom'), 'value');
      assert.strictEqual(res.getHeader('content-type'), 'application/json');
    });
  });

  describe('JSON response', () => {
    test('should send JSON response', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const data = { name: 'John', age: 30 };
      res.json(data);

      assertHeader(mockRes, 'content-type', 'application/json; charset=utf-8');
      assertJsonBody(mockRes, data);
      assertFinished(mockRes);
      assert.strictEqual(res.body, data);
    });

    test('should send JSON array', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const data = [1, 2, 3];
      res.json(data);

      assertJsonBody(mockRes, data);
    });

    test('should send JSON with nested objects', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const data = {
        user: { name: 'John', profile: { age: 30 } },
        tags: ['js', 'ts'],
      };
      res.json(data);

      assertJsonBody(mockRes, data);
    });

    test('should escape HTML in JSON (XSS protection)', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const data = { script: '<script>alert("XSS")</script>' };
      res.json(data);

      const body = mockRes.getBody();
      // Check that HTML characters are escaped to unicode sequences
      assert.ok(!body.includes('<'));
      assert.ok(!body.includes('>'));
      assert.ok(body.includes('\\u003c'));
      assert.ok(body.includes('\\u003e'));
    });
  });

  describe('Text response', () => {
    test('should send text response', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.text('Hello World');

      assertHeader(mockRes, 'content-type', 'text/plain; charset=utf-8');
      assertBody(mockRes, 'Hello World');
      assertFinished(mockRes);
      assert.strictEqual(res.body, 'Hello World');
    });

    test('should send empty text', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.text('');

      assertBody(mockRes, '');
    });
  });

  describe('HTML response', () => {
    test('should send HTML response', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const html = '<h1>Hello</h1>';
      res.html(html);

      assertHeader(mockRes, 'content-type', 'text/html; charset=utf-8');
      assertBody(mockRes, html);
      assertFinished(mockRes);
      assert.strictEqual(res.body, html);
    });
  });

  describe('Send response', () => {
    test('should send null as 204 No Content', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.send(null);

      assertStatusCode(mockRes, 204);
      assertBody(mockRes, '');
    });

    test('should send undefined as 204 No Content', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.send(undefined);

      assertStatusCode(mockRes, 204);
      assertBody(mockRes, '');
    });

    test('should send string as HTML', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.send('Hello World');

      assertHeader(mockRes, 'content-type', 'text/html; charset=utf-8');
      assertBody(mockRes, 'Hello World');
    });

    test('should send Buffer with correct content-type', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const buffer = Buffer.from('binary data');
      res.send(buffer);

      assertHeader(mockRes, 'content-type', 'application/octet-stream');
      assertBody(mockRes, 'binary data');
    });

    test('should send object as JSON', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const data = { name: 'John' };
      res.send(data);

      assertHeader(mockRes, 'content-type', 'application/json; charset=utf-8');
      assertJsonBody(mockRes, data);
    });

    test('should send array as JSON', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const data = [1, 2, 3];
      res.send(data);

      assertJsonBody(mockRes, data);
    });

    test('should respect existing content-type for string', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.type('text/plain');
      res.send('Hello World');

      assertHeader(mockRes, 'content-type', 'text/plain');
    });

    test('should respect existing content-type for Buffer', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.type('image/png');
      res.send(Buffer.from('data'));

      assertHeader(mockRes, 'content-type', 'image/png');
    });
  });

  describe('Redirect', () => {
    test('should redirect with default 302 status', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.redirect('/login');

      assertStatusCode(mockRes, 302);
      assertHeader(mockRes, 'location', '/login');
      assertBodyContains(mockRes, 'Redirecting to /login');
      assertFinished(mockRes);
    });

    test('should redirect with custom status code', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.redirect('/home', 301);

      assertStatusCode(mockRes, 301);
      assertHeader(mockRes, 'location', '/home');
    });

    test('should redirect with 303 See Other', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.redirect('/success', HttpStatus.SEE_OTHER);

      assertStatusCode(mockRes, 303);
    });
  });

  describe('Cookies', () => {
    test('should set simple cookie', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.cookie('token', 'abc123');

      const cookie = res.getHeader('set-cookie');
      assert.ok(cookie);
      assert.ok(typeof cookie === 'string');
      assert.ok(cookie.includes('token=abc123'));
      assert.ok(cookie.includes('Path=/'));
    });

    test('should set cookie with all options', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const expires = new Date('2025-12-31');
      res.cookie('session', 'xyz789', {
        domain: 'example.com',
        path: '/admin',
        expires,
        maxAge: 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });

      const cookie = res.getHeader('set-cookie') as string;
      assert.ok(cookie.includes('session=xyz789'));
      assert.ok(cookie.includes('Domain=example.com'));
      assert.ok(cookie.includes('Path=/admin'));
      assert.ok(cookie.includes('Expires='));
      assert.ok(cookie.includes('Max-Age=3600'));
      assert.ok(cookie.includes('HttpOnly'));
      assert.ok(cookie.includes('Secure'));
      assert.ok(cookie.includes('SameSite=Strict'));
    });

    test('should set multiple cookies', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.cookie('token', 'abc123');
      res.cookie('session', 'xyz789');

      const cookies = res.getHeader('set-cookie');
      assert.ok(Array.isArray(cookies));
      assert.strictEqual(cookies.length, 2);
      assert.ok(cookies[0].includes('token=abc123'));
      assert.ok(cookies[1].includes('session=xyz789'));
    });

    test('should URL encode cookie name and value', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.cookie('my cookie', 'value with spaces');

      const cookie = res.getHeader('set-cookie') as string;
      assert.ok(cookie.includes('my%20cookie=value%20with%20spaces'));
    });

    test('should clear cookie', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.clearCookie('token');

      const cookie = res.getHeader('set-cookie') as string;
      assert.ok(cookie.includes('token='));
      assert.ok(cookie.includes('Expires=Thu, 01 Jan 1970'));
      assert.ok(cookie.includes('Max-Age=0'));
    });

    test('should clear cookie with options', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.clearCookie('session', {
        domain: 'example.com',
        path: '/admin',
      });

      const cookie = res.getHeader('set-cookie') as string;
      assert.ok(cookie.includes('Domain=example.com'));
      assert.ok(cookie.includes('Path=/admin'));
    });

    test('should support cookie method chaining', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const result = res.cookie('token', 'abc123').cookie('session', 'xyz789');

      assert.strictEqual(result, res);
    });
  });

  describe('Streaming', () => {
    test('should write chunk without ending response', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      const result = res.write('chunk1');

      assert.strictEqual(result, true);
      assert.strictEqual(res.headersSent, true);
      assert.strictEqual(res.finished, false);
    });

    test('should write multiple chunks', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.write('chunk1');
      res.write('chunk2');
      res.write('chunk3');

      const chunks = mockRes.getChunks();
      assert.strictEqual(chunks.length, 3);
    });

    test('should end response with data', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.end('final data');

      assertBody(mockRes, 'final data');
      assertFinished(mockRes);
      assert.strictEqual(res.finished, true);
    });

    test('should end response without data', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.write('some data');
      res.end();

      assertFinished(mockRes);
    });

    test('should write headers before first write', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.status(201);
      res.header('X-Custom', 'value');
      res.write('data');

      assertStatusCode(mockRes, 201);
      assertHeader(mockRes, 'x-custom', 'value');
    });
  });

  describe('State management', () => {
    test('should track if headers were sent', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      assert.strictEqual(res.headersSent, false);

      res.json({ data: 'test' });

      assert.strictEqual(res.headersSent, true);
    });

    test('should track if response is finished', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      assert.strictEqual(res.finished, false);

      res.json({ data: 'test' });

      assert.strictEqual(res.finished, true);
    });

    test('should prevent setting status after headers sent', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.json({ data: 'test' });

      // Should not throw, just warn
      res.status(404);

      // Status should not change
      assertStatusCode(mockRes, 200);
    });

    test('should prevent setting header after headers sent', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.json({ data: 'test' });

      // Should not throw, just warn
      res.header('X-Custom', 'value');

      // Header should not be set
      assert.strictEqual(mockRes.getHeader('x-custom'), undefined);
    });

    test('should prevent sending response after finished', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.json({ data: 'first' });

      // Should not throw, just warn
      res.json({ data: 'second' });

      // Body should be from first response
      assertJsonBody(mockRes, { data: 'first' });
    });

    test('should prevent writing after finished', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res.end('data');

      const result = res.write('more data');

      assert.strictEqual(result, false);
    });
  });

  describe('Integration', () => {
    test('should handle complete request-response cycle', () => {
      const mockRes = createMockResponse();
      const res = new Response(mockRes);

      res
        .status(201)
        .header('X-Request-Id', 'abc123')
        .cookie('session', 'xyz789', { httpOnly: true })
        .json({ success: true, data: { id: 1 } });

      assertStatusCode(mockRes, 201);
      assertHeader(mockRes, 'x-request-id', 'abc123');
      assertHeader(mockRes, 'content-type', 'application/json; charset=utf-8');
      assertJsonBody(mockRes, { success: true, data: { id: 1 } });
      assertFinished(mockRes);

      const cookie = mockRes.getHeader('set-cookie') as string;
      assert.ok(cookie.includes('session=xyz789'));
      assert.ok(cookie.includes('HttpOnly'));
    });
  });
});
