import assert from 'node:assert';
import { after, before, describe, test } from 'node:test';
import { z } from 'zod';
import { Application } from '../../src/core/application.js';
import type {
  Middleware,
  Plugin,
  RequestContext,
  ResponseContext,
} from '../../src/utils/types.js';
import { HttpError, HttpStatus } from '../../src/utils/types.js';

describe('Application', () => {
  describe('Constructor and Options', () => {
    test('should create application with default options', () => {
      const app = new Application();
      const options = app.getOptions();

      assert.strictEqual(options.port, 3000);
      assert.strictEqual(options.host, 'localhost');
      assert.strictEqual(options.debug, false);
      assert.strictEqual(options.trustProxy, false);
      assert.strictEqual(typeof options.errorHandler, 'function');
    });

    test('should create application with custom options', () => {
      const app = new Application({
        port: 8080,
        host: '0.0.0.0',
        debug: true,
        trustProxy: true,
      });
      const options = app.getOptions();

      assert.strictEqual(options.port, 8080);
      assert.strictEqual(options.host, '0.0.0.0');
      assert.strictEqual(options.debug, true);
      assert.strictEqual(options.trustProxy, true);
    });

    test('should accept custom error handler', () => {
      const customHandler = (
        error: Error,
        req: RequestContext,
        res: ResponseContext,
      ) => {
        res.status(500).json({ custom: true });
      };

      const app = new Application({ errorHandler: customHandler });
      const options = app.getOptions();

      assert.strictEqual(options.errorHandler, customHandler);
    });

    test('should return router instance', () => {
      const app = new Application();
      const router = app.getRouter();

      assert.ok(router);
      assert.strictEqual(typeof router.match, 'function');
    });
  });

  describe('HTTP Method Registration', () => {
    test('should register GET route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.json({ method: 'GET' });
      };

      const result = app.get('/test', handler);

      assert.strictEqual(result, app); // Chainable
    });

    test('should register POST route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.json({ method: 'POST' });
      };

      const result = app.post('/test', handler);

      assert.strictEqual(result, app);
    });

    test('should register PUT route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.json({ method: 'PUT' });
      };

      const result = app.put('/test', handler);

      assert.strictEqual(result, app);
    });

    test('should register PATCH route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.json({ method: 'PATCH' });
      };

      const result = app.patch('/test', handler);

      assert.strictEqual(result, app);
    });

    test('should register DELETE route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.json({ method: 'DELETE' });
      };

      const result = app.delete('/test', handler);

      assert.strictEqual(result, app);
    });

    test('should register HEAD route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.send();
      };

      const result = app.head('/test', handler);

      assert.strictEqual(result, app);
    });

    test('should register OPTIONS route', () => {
      const app = new Application();
      const handler = (req: RequestContext, res: ResponseContext) => {
        res.send();
      };

      const result = app.options('/test', handler);

      assert.strictEqual(result, app);
    });

    test('should allow method chaining', () => {
      const app = new Application();

      app
        .get('/get', (req, res) => res.json({ method: 'GET' }))
        .post('/post', (req, res) => res.json({ method: 'POST' }))
        .put('/put', (req, res) => res.json({ method: 'PUT' }));

      // If chaining works, we got here without errors
      assert.ok(app);
    });

    test('should register route with middleware', () => {
      const app = new Application();
      const middleware: Middleware = (req, res, next) => {
        next();
      };

      app.get('/test', (req, res) => res.json({ ok: true }), {
        middleware: [middleware],
      });

      assert.ok(app);
    });

    test('should register route with schema', () => {
      const app = new Application();
      const schema = {
        body: z.object({ name: z.string() }),
      };

      app.post('/test', (req, res) => res.json({ ok: true }), { schema });

      assert.ok(app);
    });
  });

  describe('Global Middleware', () => {
    test('should register global middleware', () => {
      const app = new Application();
      const middleware: Middleware = (req, res, next) => {
        next();
      };

      const result = app.use(middleware);

      assert.strictEqual(result, app); // Chainable
    });

    test('should allow chaining multiple global middleware', () => {
      const app = new Application();
      const middleware1: Middleware = (req, res, next) => next();
      const middleware2: Middleware = (req, res, next) => next();

      app.use(middleware1).use(middleware2);

      assert.ok(app);
    });
  });

  describe('Plugin System', () => {
    test('should register plugin', async () => {
      const app = new Application();
      let installed = false;

      const plugin: Plugin = {
        name: 'test-plugin',
        install: async () => {
          installed = true;
        },
      };

      const result = await app.plugin(plugin);

      assert.strictEqual(result, app); // Chainable
      assert.strictEqual(installed, true);
    });

    test('should install plugin with middleware', async () => {
      const app = new Application();

      const plugin: Plugin = {
        name: 'middleware-plugin',
        install: async (app) => {
          app.use((req, res, next) => {
            next();
          });
        },
      };

      await app.plugin(plugin);

      assert.ok(app);
    });

    test('should install plugin with routes', async () => {
      const app = new Application();

      const plugin: Plugin = {
        name: 'route-plugin',
        install: async (app) => {
          app.get('/plugin-route', (req, res) => {
            res.json({ plugin: true });
          });
        },
      };

      await app.plugin(plugin);

      const router = app.getRouter();
      const match = router.match('GET', '/plugin-route');

      assert.strictEqual(match.status, 'MATCH');
    });
  });

  describe('Server Lifecycle', () => {
    test('should start server and return Server instance', async () => {
      const app = new Application({ port: 0 }); // Random port
      const server = await app.listen();

      assert.ok(server);
      assert.strictEqual(app.isRunning(), true);
      assert.strictEqual(app.getServer(), server);

      await app.close();
    });

    test('should start server on custom port and host', async () => {
      const app = new Application();
      const server = await app.listen(0, '127.0.0.1');

      assert.ok(server);
      assert.strictEqual(app.isRunning(), true);

      await app.close();
    });

    test('should close server', async () => {
      const app = new Application({ port: 0 });
      await app.listen();

      assert.strictEqual(app.isRunning(), true);

      await app.close();

      assert.strictEqual(app.isRunning(), false);
    });

    test('should throw error when starting already running server', async () => {
      const app = new Application({ port: 0 });
      await app.listen();

      try {
        await app.listen();
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Server already started');
      } finally {
        await app.close();
      }
    });

    test('should not throw when closing non-running server', async () => {
      const app = new Application();

      // Should not throw
      await app.close();

      assert.strictEqual(app.isRunning(), false);
    });

    test('isRunning should return false before start', () => {
      const app = new Application();

      assert.strictEqual(app.isRunning(), false);
      assert.strictEqual(app.getServer(), null);
    });
  });

  describe('Request Handling', () => {
    let app: Application;
    let server: any;

    before(async () => {
      app = new Application({ port: 0 });
      server = await app.listen();
    });

    after(async () => {
      await app.close();
    });

    test('should handle GET request', async () => {
      app.get('/test-get', (req, res) => {
        res.json({ method: req.method });
      });

      const address = server.address();
      const response = await fetch(`http://localhost:${address.port}/test-get`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.method, 'GET');
    });

    test('should handle POST request with body', async () => {
      app.post('/test-post', (req, res) => {
        res.json({ received: req.body });
      });

      const address = server.address();
      const response = await fetch(
        `http://localhost:${address.port}/test-post`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'test' }),
        },
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(data.received, { name: 'test' });
    });

    test('should handle route parameters', async () => {
      app.get('/users/:id', (req, res) => {
        res.json({ id: req.params.id });
      });

      const address = server.address();
      const response = await fetch(
        `http://localhost:${address.port}/users/123`,
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.id, '123');
    });

    test('should handle query parameters', async () => {
      app.get('/search', (req, res) => {
        res.json({ query: req.query });
      });

      const address = server.address();
      const response = await fetch(
        `http://localhost:${address.port}/search?q=test&limit=10`,
      );
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.query.q, 'test');
      assert.strictEqual(data.query.limit, '10');
    });

    test('should return 404 for non-existent route', async () => {
      const address = server.address();
      const response = await fetch(
        `http://localhost:${address.port}/non-existent`,
      );

      assert.strictEqual(response.status, 404);
    });

    test('should return 405 for method not allowed', async () => {
      app.get('/only-get', (req, res) => {
        res.json({ ok: true });
      });

      const address = server.address();
      const response = await fetch(
        `http://localhost:${address.port}/only-get`,
        {
          method: 'POST',
        },
      );

      assert.strictEqual(response.status, 405);
      assert.ok(response.headers.get('allow'));
    });

    test('should execute global middleware', async () => {
      const testApp = new Application({ port: 0 });
      let middlewareExecuted = false;

      testApp.use((req, res, next) => {
        middlewareExecuted = true;
        next();
      });

      testApp.get('/middleware-test', (req, res) => {
        res.json({ ok: true });
      });

      const testServer = await testApp.listen();
      const address = testServer.address();

      await fetch(`http://localhost:${address.port}/middleware-test`);

      assert.strictEqual(middlewareExecuted, true);

      await testApp.close();
    });

    test('should execute route-specific middleware', async () => {
      const testApp = new Application({ port: 0 });
      let routeMiddlewareExecuted = false;

      const middleware: Middleware = (req, res, next) => {
        routeMiddlewareExecuted = true;
        next();
      };

      testApp.get('/route-middleware', (req, res) => res.json({ ok: true }), {
        middleware: [middleware],
      });

      const testServer = await testApp.listen();
      const address = testServer.address();

      await fetch(`http://localhost:${address.port}/route-middleware`);

      assert.strictEqual(routeMiddlewareExecuted, true);

      await testApp.close();
    });

    test('should validate request body with schema', async () => {
      const testApp = new Application({ port: 0 });
      const schema = {
        body: z.object({
          name: z.string().min(3),
          age: z.number().positive(),
        }),
      };

      testApp.post('/validate', (req, res) => res.json(req.body), { schema });

      const testServer = await testApp.listen();
      const address = testServer.address();

      // Valid request
      const validResponse = await fetch(
        `http://localhost:${address.port}/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'John', age: 25 }),
        },
      );

      assert.strictEqual(validResponse.status, 200);

      // Invalid request
      const invalidResponse = await fetch(
        `http://localhost:${address.port}/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Jo', age: -1 }),
        },
      );

      assert.strictEqual(invalidResponse.status, 400);

      await testApp.close();
    });

    test('should return 204 if handler does not send response', async () => {
      const testApp = new Application({ port: 0 });

      testApp.get('/no-response', () => {
        // Handler doesn't send response
      });

      const testServer = await testApp.listen();
      const address = testServer.address();

      const response = await fetch(
        `http://localhost:${address.port}/no-response`,
      );

      assert.strictEqual(response.status, 204);

      await testApp.close();
    });
  });

  describe('Error Handling', () => {
    test('should handle HttpError with default handler', async () => {
      const app = new Application({ port: 0 });

      app.get('/error', () => {
        throw new HttpError(HttpStatus.BAD_REQUEST, 'Bad request error');
      });

      const server = await app.listen();
      const address = server.address();

      const response = await fetch(`http://localhost:${address.port}/error`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.strictEqual(data.error, 'Bad request error');
      assert.strictEqual(data.statusCode, 400);

      await app.close();
    });

    test('should handle generic Error with default handler', async () => {
      const app = new Application({ port: 0 });

      app.get('/error', () => {
        throw new Error('Generic error');
      });

      const server = await app.listen();
      const address = server.address();

      const response = await fetch(`http://localhost:${address.port}/error`);
      const data = await response.json();

      assert.strictEqual(response.status, 500);
      assert.strictEqual(data.error, 'Internal Server Error');
      assert.strictEqual(data.statusCode, 500);

      await app.close();
    });

    test('should include details in debug mode', async () => {
      const app = new Application({ port: 0, debug: true });

      app.get('/error', () => {
        throw new HttpError(HttpStatus.BAD_REQUEST, 'Error', {
          field: 'name',
        });
      });

      const server = await app.listen();
      const address = server.address();

      const response = await fetch(`http://localhost:${address.port}/error`);
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.details);
      assert.strictEqual(data.details.field, 'name');

      await app.close();
    });

    test('should use custom error handler', async () => {
      const customHandler = (
        error: Error,
        req: RequestContext,
        res: ResponseContext,
      ) => {
        res.status(599).json({ custom: true, message: error.message });
      };

      const app = new Application({ port: 0, errorHandler: customHandler });

      app.get('/error', () => {
        throw new Error('Test error');
      });

      const server = await app.listen();
      const address = server.address();

      const response = await fetch(`http://localhost:${address.port}/error`);
      const data = await response.json();

      assert.strictEqual(response.status, 599);
      assert.strictEqual(data.custom, true);
      assert.strictEqual(data.message, 'Test error');

      await app.close();
    });

    test('should handle async errors', async () => {
      const app = new Application({ port: 0 });

      app.get('/async-error', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new HttpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Async error');
      });

      const server = await app.listen();
      const address = server.address();

      const response = await fetch(
        `http://localhost:${address.port}/async-error`,
      );
      const data = await response.json();

      assert.strictEqual(response.status, 500);
      assert.strictEqual(data.error, 'Async error');

      await app.close();
    });
  });

  describe('Edge Cases', () => {
    test('should handle middleware stopping the chain', async () => {
      const app = new Application({ port: 0 });

      app.use((req, res) => {
        res.json({ stopped: true });
        // Don't call next()
      });

      app.get('/test', (req, res) => {
        res.json({ reached: true });
      });

      const server = await app.listen();
      const address = server.address();

      const response = await fetch(`http://localhost:${address.port}/test`);
      const data = await response.json();

      assert.strictEqual(data.stopped, true);
      assert.strictEqual(data.reached, undefined);

      await app.close();
    });

    test('should handle multiple schemas validation', async () => {
      const app = new Application({ port: 0 });
      const schema = {
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ limit: z.string() }),
        body: z.object({ name: z.string() }),
      };

      app.post('/users/:id', (req, res) => res.json({ ok: true }), { schema });

      const server = await app.listen();
      const address = server.address();

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await fetch(
        `http://localhost:${address.port}/users/${uuid}?limit=10`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        },
      );

      assert.strictEqual(response.status, 200);

      await app.close();
    });
  });
});
