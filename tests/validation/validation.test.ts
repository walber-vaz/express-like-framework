import assert from 'node:assert';
import { describe, test } from 'node:test';
import { z } from 'zod';
import { Request } from '../../src/core/request.js';
import { Response } from '../../src/core/response.js';
import { HttpError, HttpStatus } from '../../src/utils/types.js';
import {
  body,
  combine,
  commonSchemas,
  formatZodError,
  headers,
  params,
  query,
  validate,
} from '../../src/validation/index.js';
import {
  createMockJsonRequest,
  createMockRequest,
  createMockResponse,
} from '../helpers/mock-http.js';

describe('Validation', () => {
  describe('validate() middleware', () => {
    test('should validate body successfully', async () => {
      const schema = {
        body: z.object({
          name: z.string(),
          age: z.number(),
        }),
      };

      const mockReq = createMockJsonRequest(
        { name: 'John', age: 30 },
        { method: 'POST', url: '/test' },
      );
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await req.parseBody();

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.deepStrictEqual(req.body, { name: 'John', age: 30 });
    });

    test('should throw HttpError for invalid body', async () => {
      const schema = {
        body: z.object({
          name: z.string(),
          age: z.number(),
        }),
      };

      const mockReq = createMockJsonRequest(
        { name: 'John', age: 'invalid' },
        { method: 'POST', url: '/test' },
      );
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await req.parseBody();

      let error: Error | undefined;
      const next = (err?: Error) => {
        error = err;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.ok(error instanceof HttpError);
      assert.strictEqual(error.statusCode, HttpStatus.BAD_REQUEST);
      assert.strictEqual(error.message, 'Invalid request body');
      assert.ok(error.details);
    });

    test('should validate params successfully', async () => {
      const schema = {
        params: z.object({
          id: z.string().uuid(),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/users/550e8400-e29b-41d4-a716-446655440000',
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      req.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.params.id, '550e8400-e29b-41d4-a716-446655440000');
    });

    test('should throw HttpError for invalid params', async () => {
      const schema = {
        params: z.object({
          id: z.string().uuid(),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/users/123',
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      req.params = { id: '123' };

      let error: Error | undefined;
      const next = (err?: Error) => {
        error = err;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.ok(error instanceof HttpError);
      assert.strictEqual(error.statusCode, HttpStatus.BAD_REQUEST);
      assert.strictEqual(error.message, 'Invalid route parameters');
    });

    test('should validate query successfully', async () => {
      const schema = {
        query: z.object({
          page: z.coerce.number().int().positive(),
          limit: z.coerce.number().int().positive(),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/users?page=2&limit=20',
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.query.page, 2);
      assert.strictEqual(req.query.limit, 20);
    });

    test('should throw HttpError for invalid query', async () => {
      const schema = {
        query: z.object({
          page: z.coerce.number().int().positive(),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/users?page=-1',
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let error: Error | undefined;
      const next = (err?: Error) => {
        error = err;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.ok(error instanceof HttpError);
      assert.strictEqual(error.statusCode, HttpStatus.BAD_REQUEST);
      assert.strictEqual(error.message, 'Invalid query parameters');
    });

    test('should validate headers successfully', async () => {
      const schema = {
        headers: z.object({
          'x-api-key': z.string().min(10),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/api/data',
        headers: { 'x-api-key': 'secret-key-123' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.headers['x-api-key'], 'secret-key-123');
    });

    test('should throw HttpError for invalid headers', async () => {
      const schema = {
        headers: z.object({
          'x-api-key': z.string().min(10),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/api/data',
        headers: { 'x-api-key': 'short' },
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let error: Error | undefined;
      const next = (err?: Error) => {
        error = err;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.ok(error instanceof HttpError);
      assert.strictEqual(error.statusCode, HttpStatus.BAD_REQUEST);
      assert.strictEqual(error.message, 'Invalid headers');
    });

    test('should validate multiple schemas at once', async () => {
      const schema = {
        body: z.object({ name: z.string() }),
        params: z.object({ id: z.string() }),
        query: z.object({ filter: z.string() }),
      };

      const mockReq = createMockJsonRequest(
        { name: 'John' },
        { method: 'POST', url: '/users/123?filter=active' },
      );
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      await req.parseBody();
      req.params = { id: '123' };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.deepStrictEqual(req.body, { name: 'John' });
      assert.strictEqual(req.params.id, '123');
      assert.strictEqual(req.query.filter, 'active');
    });

    test('should apply default values', async () => {
      const schema = {
        query: z.object({
          page: z.coerce.number().default(1),
          limit: z.coerce.number().default(10),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/users',
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.query.page, 1);
      assert.strictEqual(req.query.limit, 10);
    });

    test('should transform data with coerce', async () => {
      const schema = {
        query: z.object({
          age: z.coerce.number(),
          active: z.coerce.boolean(),
        }),
      };

      const mockReq = createMockRequest({
        method: 'GET',
        url: '/users?age=25&active=true',
      });
      const mockRes = createMockResponse();
      const req = new Request(mockReq);
      const res = new Response(mockRes);

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const middleware = validate(schema);
      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.query.age, 25);
      assert.strictEqual(req.query.active, true);
    });
  });

  describe('formatZodError()', () => {
    test('should format single error', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({ name: 123 });

      if (!result.success) {
        const formatted = formatZodError(result.error);
        assert.ok(Array.isArray(formatted));
        assert.strictEqual((formatted as any[]).length, 1);
        assert.strictEqual((formatted as any[])[0].path, 'name');
        assert.ok((formatted as any[])[0].message);
        assert.ok((formatted as any[])[0].code);
      } else {
        assert.fail('Expected validation to fail');
      }
    });

    test('should format multiple errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });
      const result = schema.safeParse({
        name: 123,
        age: 'invalid',
        email: 'not-an-email',
      });

      if (!result.success) {
        const formatted = formatZodError(result.error);
        assert.ok(Array.isArray(formatted));
        assert.strictEqual((formatted as any[]).length, 3);
      } else {
        assert.fail('Expected validation to fail');
      }
    });

    test('should format nested path errors', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
          }),
        }),
      });
      const result = schema.safeParse({ user: { profile: { name: 123 } } });

      if (!result.success) {
        const formatted = formatZodError(result.error);
        assert.strictEqual((formatted as any[])[0].path, 'user.profile.name');
      } else {
        assert.fail('Expected validation to fail');
      }
    });
  });

  describe('Schema helpers', () => {
    test('body() should create body schema', () => {
      const schema = body(z.object({ name: z.string() }));
      assert.ok(schema.body);
      assert.strictEqual(schema.params, undefined);
      assert.strictEqual(schema.query, undefined);
      assert.strictEqual(schema.headers, undefined);
    });

    test('params() should create params schema', () => {
      const schema = params(z.object({ id: z.string() }));
      assert.ok(schema.params);
      assert.strictEqual(schema.body, undefined);
      assert.strictEqual(schema.query, undefined);
      assert.strictEqual(schema.headers, undefined);
    });

    test('query() should create query schema', () => {
      const schema = query(z.object({ page: z.string() }));
      assert.ok(schema.query);
      assert.strictEqual(schema.body, undefined);
      assert.strictEqual(schema.params, undefined);
      assert.strictEqual(schema.headers, undefined);
    });

    test('headers() should create headers schema', () => {
      const schema = headers(z.object({ authorization: z.string() }));
      assert.ok(schema.headers);
      assert.strictEqual(schema.body, undefined);
      assert.strictEqual(schema.params, undefined);
      assert.strictEqual(schema.query, undefined);
    });

    test('combine() should merge multiple schemas', () => {
      const schema = combine(
        body(z.object({ name: z.string() })),
        params(z.object({ id: z.string() })),
        query(z.object({ filter: z.string() })),
      );

      assert.ok(schema.body);
      assert.ok(schema.params);
      assert.ok(schema.query);
    });

    test('combine() should override with last schema', () => {
      const schema = combine(
        body(z.object({ name: z.string() })),
        body(z.object({ email: z.string() })),
      );

      assert.ok(schema.body);

      // Validate that the second body schema was used
      const result = schema.body?.safeParse({ email: 'test@example.com' });
      assert.strictEqual(result?.success, true);
    });
  });

  describe('commonSchemas', () => {
    test('numericId should validate numeric ID', () => {
      const result = commonSchemas.numericId.safeParse({ id: '123' });
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.id, 123);
      }
    });

    test('numericId should reject non-numeric ID', () => {
      const result = commonSchemas.numericId.safeParse({ id: 'abc' });
      assert.strictEqual(result.success, false);
    });

    test('numericId should reject negative ID', () => {
      const result = commonSchemas.numericId.safeParse({ id: '-1' });
      assert.strictEqual(result.success, false);
    });

    test('uuidId should validate UUID', () => {
      const result = commonSchemas.uuidId.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      assert.strictEqual(result.success, true);
    });

    test('uuidId should reject invalid UUID', () => {
      const result = commonSchemas.uuidId.safeParse({ id: '123' });
      assert.strictEqual(result.success, false);
    });

    test('stringId should validate any non-empty string', () => {
      const result = commonSchemas.stringId.safeParse({ id: 'abc123' });
      assert.strictEqual(result.success, true);
    });

    test('stringId should reject empty string', () => {
      const result = commonSchemas.stringId.safeParse({ id: '' });
      assert.strictEqual(result.success, false);
    });

    test('pagination should apply defaults', () => {
      const result = commonSchemas.pagination.safeParse({});
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.page, 1);
        assert.strictEqual(result.data.limit, 10);
      }
    });

    test('pagination should coerce string values', () => {
      const result = commonSchemas.pagination.safeParse({
        page: '2',
        limit: '20',
      });
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.page, 2);
        assert.strictEqual(result.data.limit, 20);
      }
    });

    test('pagination should enforce max limit', () => {
      const result = commonSchemas.pagination.safeParse({ limit: '200' });
      assert.strictEqual(result.success, false);
    });

    test('sorting should apply default sortOrder', () => {
      const result = commonSchemas.sorting.safeParse({});
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.sortOrder, 'asc');
      }
    });

    test('sorting should validate sortOrder enum', () => {
      const result1 = commonSchemas.sorting.safeParse({ sortOrder: 'asc' });
      const result2 = commonSchemas.sorting.safeParse({ sortOrder: 'desc' });
      const result3 = commonSchemas.sorting.safeParse({ sortOrder: 'invalid' });

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      assert.strictEqual(result3.success, false);
    });

    test('sorting should allow optional sortBy', () => {
      const result1 = commonSchemas.sorting.safeParse({ sortBy: 'name' });
      const result2 = commonSchemas.sorting.safeParse({});

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
    });

    test('email should validate email format', () => {
      const result1 = commonSchemas.email.safeParse({
        email: 'test@example.com',
      });
      const result2 = commonSchemas.email.safeParse({ email: 'invalid' });

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, false);
    });

    test('timestamps should validate datetime strings', () => {
      const result = commonSchemas.timestamps.safeParse({
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      });
      assert.strictEqual(result.success, true);
    });

    test('timestamps should allow optional fields', () => {
      const result1 = commonSchemas.timestamps.safeParse({});
      const result2 = commonSchemas.timestamps.safeParse({
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
    });

    test('timestamps should reject invalid datetime', () => {
      const result = commonSchemas.timestamps.safeParse({
        createdAt: 'invalid-date',
      });
      assert.strictEqual(result.success, false);
    });
  });
});
