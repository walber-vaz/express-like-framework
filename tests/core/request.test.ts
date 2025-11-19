/**
 * Tests for Request wrapper
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';
import { Request } from '../../dist/core/request.js';
import { HttpError } from '../../dist/utils/types.js';
import {
  createMockFormRequest,
  createMockJsonRequest,
  createMockRequest,
} from '../helpers/mock-http.js';

describe('Request', () => {
  describe('Constructor and parsing', () => {
    test('should create request from IncomingMessage', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      assert.ok(req);
      assert.strictEqual(req.raw, mockReq);
    });

    test('should parse method', () => {
      const mockReq = createMockRequest({ method: 'POST' });
      const req = new Request(mockReq);

      assert.strictEqual(req.method, 'POST');
    });

    test('should default to GET method', () => {
      const mockReq = createMockRequest({ method: undefined });
      const req = new Request(mockReq);

      assert.strictEqual(req.method, 'GET');
    });

    test('should uppercase method', () => {
      const mockReq = createMockRequest({ method: 'post' });
      const req = new Request(mockReq);

      assert.strictEqual(req.method, 'POST');
    });

    test('should parse URL', () => {
      const mockReq = createMockRequest({ url: '/users?name=John' });
      const req = new Request(mockReq);

      assert.strictEqual(req.url, '/users?name=John');
    });

    test('should extract path from URL', () => {
      const mockReq = createMockRequest({ url: '/users?name=John' });
      const req = new Request(mockReq);

      assert.strictEqual(req.path, '/users');
    });

    test('should default to / path', () => {
      const mockReq = createMockRequest({ url: undefined });
      const req = new Request(mockReq);

      assert.strictEqual(req.path, '/');
    });

    test('should parse single query parameter', () => {
      const mockReq = createMockRequest({ url: '/users?name=John' });
      const req = new Request(mockReq);

      assert.strictEqual(req.query.name, 'John');
    });

    test('should parse multiple query parameters', () => {
      const mockReq = createMockRequest({ url: '/users?name=John&age=30' });
      const req = new Request(mockReq);

      assert.strictEqual(req.query.name, 'John');
      assert.strictEqual(req.query.age, '30');
    });

    test('should parse duplicate query parameters as array', () => {
      const mockReq = createMockRequest({ url: '/users?tag=js&tag=ts' });
      const req = new Request(mockReq);

      assert.deepStrictEqual(req.query.tag, ['js', 'ts']);
    });

    test('should parse headers', () => {
      const mockReq = createMockRequest({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
        },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.headers['content-type'], 'application/json');
      assert.strictEqual(req.headers['authorization'], 'Bearer token123');
    });

    test('should normalize header names to lowercase', () => {
      const mockReq = createMockRequest({
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value',
        },
      });
      const req = new Request(mockReq);

      assert.ok('content-type' in req.headers);
      assert.ok('x-custom-header' in req.headers);
    });
  });

  describe('Body parsing', () => {
    test('should parse JSON body', async () => {
      const mockReq = createMockJsonRequest({ name: 'John', age: 30 });
      const req = new Request(mockReq);

      const body = await req.parseBody();

      assert.deepStrictEqual(body, { name: 'John', age: 30 });
      assert.deepStrictEqual(req.body, { name: 'John', age: 30 });
    });

    test('should parse form data body', async () => {
      const mockReq = createMockFormRequest({
        name: 'John',
        email: 'john@example.com',
      });
      const req = new Request(mockReq);

      const body = await req.parseBody();

      assert.deepStrictEqual(body, { name: 'John', email: 'john@example.com' });
    });

    test('should parse text body', async () => {
      const mockReq = createMockRequest({
        headers: { 'content-type': 'text/plain' },
        body: 'Hello World',
      });
      const req = new Request(mockReq);

      const body = await req.parseBody();

      assert.strictEqual(body, 'Hello World');
    });

    test('should return cached body on subsequent calls', async () => {
      const mockReq = createMockJsonRequest({ name: 'John' });
      const req = new Request(mockReq);

      const body1 = await req.parseBody();
      const body2 = await req.parseBody();

      assert.strictEqual(body1, body2);
    });

    test('should handle empty body', async () => {
      const mockReq = createMockRequest({
        headers: { 'content-type': 'application/json' },
        body: '',
      });
      const req = new Request(mockReq);

      const body = await req.parseBody();

      assert.strictEqual(body, undefined);
    });

    test('should throw HttpError for invalid JSON', async () => {
      const mockReq = createMockRequest({
        headers: { 'content-type': 'application/json' },
        body: '{invalid json}',
      });
      const req = new Request(mockReq);

      await assert.rejects(
        async () => await req.parseBody(),
        (error: Error) => {
          assert.ok(error instanceof HttpError);
          assert.strictEqual((error as HttpError).statusCode, 400);
          assert.ok(error.message.includes('Invalid JSON'));
          return true;
        },
      );
    });
  });

  describe('Header methods', () => {
    test('should get header by name (case-insensitive)', () => {
      const mockReq = createMockRequest({
        headers: { 'Content-Type': 'application/json' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.get('content-type'), 'application/json');
      assert.strictEqual(req.get('Content-Type'), 'application/json');
      assert.strictEqual(req.get('CONTENT-TYPE'), 'application/json');
    });

    test('should return undefined for missing header', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      assert.strictEqual(req.get('x-missing'), undefined);
    });

    test('should check if header exists', () => {
      const mockReq = createMockRequest({
        headers: { 'Content-Type': 'application/json' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.has('content-type'), true);
      assert.strictEqual(req.has('x-missing'), false);
    });

    test('should check accept header for specific type', () => {
      const mockReq = createMockRequest({
        headers: { accept: 'application/json, text/html' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.accepts('application/json'), true);
      assert.strictEqual(req.accepts('text/html'), true);
      assert.strictEqual(req.accepts('application/xml'), false);
    });

    test('should accept wildcard in accept header', () => {
      const mockReq = createMockRequest({
        headers: { accept: '*/*' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.accepts('application/json'), true);
      assert.strictEqual(req.accepts('text/html'), true);
    });

    test('should return false if accept header is missing', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      assert.strictEqual(req.accepts('application/json'), false);
    });
  });

  describe('Content type methods', () => {
    test('should check if request is JSON', () => {
      const mockReq = createMockRequest({
        headers: { 'content-type': 'application/json' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.isJson(), true);
    });

    test('should check if request is JSON with charset', () => {
      const mockReq = createMockRequest({
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.isJson(), true);
    });

    test('should return false for non-JSON content type', () => {
      const mockReq = createMockRequest({
        headers: { 'content-type': 'text/plain' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.isJson(), false);
    });

    test('should return false if content-type is missing', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      assert.strictEqual(req.isJson(), false);
    });
  });

  describe('Network methods', () => {
    test('should get IP from socket', () => {
      const mockReq = createMockRequest({
        socket: { remoteAddress: '192.168.1.1' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.ip(), '192.168.1.1');
    });

    test('should get IP from X-Forwarded-For header when trusting proxy', () => {
      const mockReq = createMockRequest({
        headers: { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.ip(true), '203.0.113.1');
    });

    test('should get IP from X-Real-IP header when trusting proxy', () => {
      const mockReq = createMockRequest({
        headers: { 'x-real-ip': '203.0.113.1' },
        socket: { remoteAddress: '127.0.0.1' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.ip(true), '203.0.113.1');
    });

    test('should ignore proxy headers when not trusting proxy', () => {
      const mockReq = createMockRequest({
        headers: { 'x-forwarded-for': '203.0.113.1' },
        socket: { remoteAddress: '192.168.1.1' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.ip(false), '192.168.1.1');
    });

    test('should get hostname from Host header', () => {
      const mockReq = createMockRequest({
        headers: { host: 'example.com:3000' },
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.hostname(), 'example.com');
    });

    test('should default to localhost if Host header is missing', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      assert.strictEqual(req.hostname(), 'localhost');
    });

    test('should get protocol from socket', () => {
      const mockReq = createMockRequest({
        socket: { encrypted: false } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.protocol(), 'http');
    });

    test('should get protocol from X-Forwarded-Proto header when trusting proxy', () => {
      const mockReq = createMockRequest({
        headers: { 'x-forwarded-proto': 'https' },
        socket: { encrypted: false } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.protocol(true), 'https');
    });

    test('should ignore proxy headers when not trusting proxy', () => {
      const mockReq = createMockRequest({
        headers: { 'x-forwarded-proto': 'https' },
        socket: { encrypted: false } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.protocol(false), 'http');
    });

    test('should check if request is secure', () => {
      const mockReq = createMockRequest({
        socket: { encrypted: true } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.secure(), true);
    });

    test('should check if request is not secure', () => {
      const mockReq = createMockRequest({
        socket: { encrypted: false } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.secure(), false);
    });

    test('should construct full URL', () => {
      const mockReq = createMockRequest({
        url: '/users?name=John',
        headers: { host: 'example.com' },
        socket: { encrypted: false } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.fullUrl(), 'http://example.com/users?name=John');
    });

    test('should construct full URL with HTTPS', () => {
      const mockReq = createMockRequest({
        url: '/users',
        headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
        socket: { encrypted: false } as any,
      });
      const req = new Request(mockReq);

      assert.strictEqual(req.fullUrl(true), 'https://example.com/users');
    });
  });

  describe('Route params', () => {
    test('should initialize with empty params', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      assert.deepStrictEqual(req.params, {});
    });

    test('should allow params to be set externally', () => {
      const mockReq = createMockRequest();
      const req = new Request(mockReq);

      req.params = { id: '123', name: 'test' };

      assert.strictEqual(req.params.id, '123');
      assert.strictEqual(req.params.name, 'test');
    });
  });
});
