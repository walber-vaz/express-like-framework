/**
 * Tests for Router and RouteBuilder
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';
import { z } from 'zod';
import { RouteBuilder, Router } from '../../dist/core/router.js';
import type { Handler, Middleware } from '../../dist/utils/types.js';
import { createSpy } from '../helpers/test-utils.js';

describe('Router', () => {
  test('should create empty router', () => {
    const router = new Router();
    assert.strictEqual(router.size, 0);
  });

  test('should add global middleware', () => {
    const router = new Router();
    const middleware = createSpy<Middleware>();

    const result = router.use(middleware);

    // Should return router for chaining
    assert.strictEqual(result, router);
  });

  test('should add route with addRoute()', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.addRoute('GET', '/users', handler);

    assert.strictEqual(router.size, 1);
  });

  test('should support method chaining', () => {
    const router = new Router();
    const handler1 = createSpy<Handler>();
    const handler2 = createSpy<Handler>();

    const result = router.get('/users', handler1).post('/users', handler2);

    assert.strictEqual(result, router);
    assert.strictEqual(router.size, 2);
  });

  test('should add GET route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);

    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'GET');
      assert.strictEqual(match.route.path, '/users');
      assert.strictEqual(match.route.handler, handler);
    }
  });

  test('should add POST route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.post('/users', handler);

    const match = router.match('POST', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'POST');
    }
  });

  test('should add PUT route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.put('/users/:id', handler);

    const match = router.match('PUT', '/users/123');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'PUT');
    }
  });

  test('should add PATCH route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.patch('/users/:id', handler);

    const match = router.match('PATCH', '/users/123');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'PATCH');
    }
  });

  test('should add DELETE route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.delete('/users/:id', handler);

    const match = router.match('DELETE', '/users/123');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'DELETE');
    }
  });

  test('should add HEAD route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.head('/users', handler);

    const match = router.match('HEAD', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'HEAD');
    }
  });

  test('should add OPTIONS route', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.options('/users', handler);

    const match = router.match('OPTIONS', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.method, 'OPTIONS');
    }
  });

  test('should match route with named parameters', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users/:id', handler);

    const match = router.match('GET', '/users/123');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      // find-my-way returns params with null prototype, so check properties directly
      assert.strictEqual(match.params.id, '123');
      assert.strictEqual(Object.keys(match.params).length, 1);
    }
  });

  test('should match route with multiple parameters', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users/:userId/posts/:postId', handler);

    const match = router.match('GET', '/users/123/posts/456');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      // find-my-way returns params with null prototype, so check properties directly
      assert.strictEqual(match.params.userId, '123');
      assert.strictEqual(match.params.postId, '456');
      assert.strictEqual(Object.keys(match.params).length, 2);
    }
  });

  test('should match route with wildcard', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/files/*', handler);

    const match = router.match('GET', '/files/path/to/file.txt');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.ok(match.params['*']);
    }
  });

  test('should be case insensitive by default', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/Users', handler);

    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'MATCH');
  });

  test('should ignore trailing slash', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);

    const match1 = router.match('GET', '/users');
    const match2 = router.match('GET', '/users/');

    assert.strictEqual(match1.status, 'MATCH');
    assert.strictEqual(match2.status, 'MATCH');
  });

  test('should return NOT_FOUND for non-existent path', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);

    const match = router.match('GET', '/posts');
    assert.strictEqual(match.status, 'NOT_FOUND');
  });

  test('should return METHOD_NOT_ALLOWED when path exists with different method', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);

    const match = router.match('POST', '/users');
    assert.strictEqual(match.status, 'METHOD_NOT_ALLOWED');
    if (match.status === 'METHOD_NOT_ALLOWED') {
      assert.ok(match.allowedMethods?.includes('GET'));
    }
  });

  test('should include route middleware in match result', () => {
    const router = new Router();
    const handler = createSpy<Handler>();
    const middleware1 = createSpy<Middleware>();
    const middleware2 = createSpy<Middleware>();

    router.get('/users', handler, { middleware: [middleware1, middleware2] });

    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.ok(match.route.middleware.includes(middleware1));
      assert.ok(match.route.middleware.includes(middleware2));
    }
  });

  test('should combine global and route middleware', () => {
    const router = new Router();
    const handler = createSpy<Handler>();
    const globalMiddleware = createSpy<Middleware>();
    const routeMiddleware = createSpy<Middleware>();

    router.use(globalMiddleware);
    router.get('/users', handler, { middleware: [routeMiddleware] });

    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      // Global middleware should come first
      assert.strictEqual(match.route.middleware[0], globalMiddleware);
      assert.strictEqual(match.route.middleware[1], routeMiddleware);
    }
  });
  test('should include schema in match result', () => {
    const router = new Router();
    const handler = createSpy<Handler>();
    const schema = { body: z.object({}) };

    router.get('/users', handler, { schema });

    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.schema, schema);
    }
  });

  test('should get allowed methods for a path', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);
    router.post('/users', handler);
    router.put('/users', handler);

    const methods = router.getAllowedMethods('/users');
    assert.ok(methods.includes('GET'));
    assert.ok(methods.includes('POST'));
    assert.ok(methods.includes('PUT'));
  });

  test('should return empty array for non-existent path', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);

    const methods = router.getAllowedMethods('/posts');
    assert.deepStrictEqual(methods, []);
  });

  test('should get routes', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.get('/users', handler);
    router.post('/users', handler);

    const routes = router.getRoutes();
    // find-my-way returns tree structure
    assert.ok(routes);
  });

  test('should clear all routes', () => {
    const router = new Router();
    const handler = createSpy<Handler>();
    const middleware = createSpy<Middleware>();

    router.use(middleware);
    router.get('/users', handler);
    router.post('/posts', handler);

    assert.strictEqual(router.size, 2);

    router.clear();

    assert.strictEqual(router.size, 0);
    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'NOT_FOUND');
  });

  test('should handle multiple routes with same method', () => {
    const router = new Router();
    const handler1 = createSpy<Handler>();
    const handler2 = createSpy<Handler>();

    router.get('/users', handler1);
    router.get('/posts', handler2);

    const match1 = router.match('GET', '/users');
    const match2 = router.match('GET', '/posts');

    assert.strictEqual(match1.status, 'MATCH');
    assert.strictEqual(match2.status, 'MATCH');
    if (match1.status === 'MATCH' && match2.status === 'MATCH') {
      assert.strictEqual(match1.route.handler, handler1);
      assert.strictEqual(match2.route.handler, handler2);
    }
  });

  test('should handle route priority correctly', () => {
    const router = new Router();
    const staticHandler = createSpy<Handler>();
    const paramHandler = createSpy<Handler>();

    // Static routes should match before parameterized routes
    router.get('/users/me', staticHandler);
    router.get('/users/:id', paramHandler);

    const match = router.match('GET', '/users/me');
    assert.strictEqual(match.status, 'MATCH');
    if (match.status === 'MATCH') {
      assert.strictEqual(match.route.handler, staticHandler);
    }
  });

  test('should support adding multiple methods to same path', () => {
    const router = new Router();
    const handler = createSpy<Handler>();

    router.addRoute(['GET', 'POST'], '/users', handler);

    const matchGet = router.match('GET', '/users');
    const matchPost = router.match('POST', '/users');

    assert.strictEqual(matchGet.status, 'MATCH');
    assert.strictEqual(matchPost.status, 'MATCH');
  });
});

describe('RouteBuilder', () => {
  test('should create route builder with path', () => {
    const builder = new RouteBuilder('/users');
    assert.ok(builder);
  });

  test('should set method', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    const result = builder.method('GET').handler(handler);

    assert.strictEqual(result, builder);
    const route = builder.build();
    assert.strictEqual(route.method, 'GET');
  });

  test('should set method with get()', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.get().handler(handler);

    const route = builder.build();
    assert.strictEqual(route.method, 'GET');
  });

  test('should set method with post()', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.post().handler(handler);

    const route = builder.build();
    assert.strictEqual(route.method, 'POST');
  });

  test('should set method with put()', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.put().handler(handler);

    const route = builder.build();
    assert.strictEqual(route.method, 'PUT');
  });

  test('should set method with patch()', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.patch().handler(handler);

    const route = builder.build();
    assert.strictEqual(route.method, 'PATCH');
  });

  test('should set method with delete()', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.delete().handler(handler);

    const route = builder.build();
    assert.strictEqual(route.method, 'DELETE');
  });

  test('should set handler', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.get().handler(handler);

    const route = builder.build();
    assert.strictEqual(route.handler, handler);
  });

  test('should add middleware', () => {
    const handler = createSpy<Handler>();
    const middleware1 = createSpy<Middleware>();
    const middleware2 = createSpy<Middleware>();
    const builder = new RouteBuilder('/users');

    builder.get().handler(handler).middleware(middleware1, middleware2);

    const route = builder.build();
    assert.deepStrictEqual(route.middleware, [middleware1, middleware2]);
  });
  test('should set schema', () => {
    const handler = createSpy<Handler>();
    const schema = { body: z.object({}) };
    const builder = new RouteBuilder('/users');

    builder.get().handler(handler).schema(schema);

    const route = builder.build();
    assert.strictEqual(route.schema, schema);
  });
  test('should build complete route', () => {
    const handler = createSpy<Handler>();
    const middleware = createSpy<Middleware>();
    const schema = { body: z.object({}) };

    const builder = new RouteBuilder('/users/:id');
    const route = builder
      .get()
      .handler(handler)
      .middleware(middleware)
      .schema(schema)
      .build();

    assert.strictEqual(route.method, 'GET');
    assert.strictEqual(route.path, '/users/:id');
    assert.strictEqual(route.handler, handler);
    assert.deepStrictEqual(route.middleware, [middleware]);
    assert.strictEqual(route.schema, schema);
  });

  test('should throw error if method is not set', () => {
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.handler(handler);

    assert.throws(() => builder.build(), {
      message: 'Route method is required',
    });
  });

  test('should throw error if handler is not set', () => {
    const builder = new RouteBuilder('/users');

    builder.get();

    assert.throws(() => builder.build(), {
      message: 'Route handler is required',
    });
  });

  test('should register route with router', () => {
    const router = new Router();
    const handler = createSpy<Handler>();
    const builder = new RouteBuilder('/users');

    builder.get().handler(handler).register(router);

    assert.strictEqual(router.size, 1);
    const match = router.match('GET', '/users');
    assert.strictEqual(match.status, 'MATCH');
  });

  test('should support fluent API', () => {
    const handler = createSpy<Handler>();
    const middleware = createSpy<Middleware>();

    const route = new RouteBuilder('/users/:id')
      .get()
      .handler(handler)
      .middleware(middleware)
      .build();

    assert.strictEqual(route.method, 'GET');
    assert.strictEqual(route.path, '/users/:id');
  });
});
