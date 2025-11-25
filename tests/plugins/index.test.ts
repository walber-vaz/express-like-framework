import assert from 'node:assert';
import { after, before, describe, test } from 'node:test';
import { Application } from '../../src/core/application.js';
import {
  createPlugin,
  type Plugin,
  PluginBuilder,
  plugins,
} from '../../src/plugins/index.js';
import type { RequestContext, ResponseContext } from '../../src/utils/types.js';

describe('Plugins', () => {
  describe('PluginBuilder', () => {
    test('should create plugin builder', () => {
      const builder = createPlugin('test');
      assert.ok(builder instanceof PluginBuilder);
    });

    test('should add middleware to plugin', () => {
      const middleware = (
        _req: RequestContext,
        _res: ResponseContext,
        next: () => void,
      ) => next();
      const plugin = createPlugin('test').middleware(middleware).build();

      assert.strictEqual(plugin.name, 'test');
    });

    test('should add multiple middlewares to plugin', () => {
      const mw1 = (
        _req: RequestContext,
        _res: ResponseContext,
        next: () => void,
      ) => next();
      const mw2 = (
        _req: RequestContext,
        _res: ResponseContext,
        next: () => void,
      ) => next();

      const plugin = createPlugin('test').middleware(mw1, mw2).build();

      assert.strictEqual(plugin.name, 'test');
    });

    test('should add route to plugin', () => {
      const handler = (_req: RequestContext, res: ResponseContext) => {
        res.json({ test: true });
      };

      const plugin = createPlugin('test')
        .route('GET', '/test', handler)
        .build();

      assert.strictEqual(plugin.name, 'test');
    });

    test('should add onInstall callback', () => {
      let installed = false;
      const plugin = createPlugin('test')
        .onInstall(() => {
          installed = true;
        })
        .build();

      assert.strictEqual(plugin.name, 'test');
      assert.ok(plugin.install);
    });

    test('should build plugin with all features', () => {
      const plugin = createPlugin('full-featured')
        .middleware((_req, _res, next) => next())
        .route('GET', '/plugin', (_req, res) => res.json({ ok: true }))
        .onInstall(() => {})
        .build();

      assert.strictEqual(plugin.name, 'full-featured');
      assert.ok(typeof plugin.install === 'function');
    });
  });

  describe('Built-in plugins', () => {
    describe('logging plugin', () => {
      let app: Application;
      let server: Awaited<ReturnType<typeof app.listen>>;

      before(async () => {
        app = new Application({ port: 0 });
      });

      after(async () => {
        if (server) {
          await app.close();
        }
      });

      test('should install logging plugin', async () => {
        const logPlugin = plugins.logging();
        await app.plugin(logPlugin);
        assert.strictEqual(logPlugin.name, 'logging');
      });

      test('should install logging plugin with options', async () => {
        const app2 = new Application({ port: 0 });
        const logPlugin = plugins.logging({
          includeHeaders: true,
          includeBody: true,
          performanceThreshold: 500,
        });
        await app2.plugin(logPlugin);
        assert.strictEqual(logPlugin.name, 'logging');
      });
    });

    describe('security plugin', () => {
      test('should install security plugin', async () => {
        const app = new Application({ port: 0 });
        const secPlugin = plugins.security();
        await app.plugin(secPlugin);
        assert.strictEqual(secPlugin.name, 'security');
      });

      test('should install security plugin with custom options', async () => {
        const app = new Application({ port: 0 });
        const secPlugin = plugins.security({
          corsOptions: { origin: '*' },
          helmetOptions: {},
          rateLimitOptions: { max: 50 },
        });
        await app.plugin(secPlugin);
        assert.strictEqual(secPlugin.name, 'security');
      });
    });

    describe('healthCheck plugin', () => {
      let app: Application;
      let server: Awaited<ReturnType<typeof app.listen>>;

      before(async () => {
        app = new Application({ port: 0 });
        const healthPlugin = plugins.healthCheck();
        await app.plugin(healthPlugin);
        server = await app.listen();
      });

      after(async () => {
        if (server) {
          await app.close();
        }
      });

      test('should install healthCheck plugin', () => {
        assert.ok(server);
      });

      test('should respond to health check endpoint', async () => {
        const port = server?.address()?.port;
        const response = await fetch(`http://localhost:${port}/health`);
        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(data.status, 'ok');
        assert.ok(data.timestamp);
      });

      test('should use custom path for health check', async () => {
        const app2 = new Application({ port: 0 });
        const healthPlugin = plugins.healthCheck({ path: '/status' });
        await app2.plugin(healthPlugin);
        const server2 = await app2.listen();

        const port = server2?.address()?.port;
        const response = await fetch(`http://localhost:${port}/status`);
        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(data.status, 'ok');

        await app2.close();
      });

      test('should use custom health check function', async () => {
        const app2 = new Application({ port: 0 });
        const healthPlugin = plugins.healthCheck({
          customCheck: async () => ({
            status: 'healthy',
            details: { uptime: 100 },
          }),
        });
        await app2.plugin(healthPlugin);
        const server2 = await app2.listen();

        const port = server2?.address()?.port;
        const response = await fetch(`http://localhost:${port}/health`);
        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(data.status, 'healthy');
        assert.ok(data.details);

        await app2.close();
      });
    });

    describe('metrics plugin', () => {
      let app: Application;
      let server: Awaited<ReturnType<typeof app.listen>>;

      before(async () => {
        app = new Application({ port: 0 });
        const metricsPlugin = plugins.metrics();
        await app.plugin(metricsPlugin);
        server = await app.listen();
      });

      after(async () => {
        if (server) {
          await app.close();
        }
      });

      test('should install metrics plugin', () => {
        assert.ok(server);
      });

      test('should respond to metrics endpoint', async () => {
        const port = server?.address()?.port;
        const response = await fetch(`http://localhost:${port}/metrics`);
        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.ok(typeof data.uptime === 'number');
        assert.ok(typeof data.requests === 'number');
        assert.ok(typeof data.errors === 'number');
        assert.ok(typeof data.errorRate === 'number');
      });

      test('should use custom path for metrics', async () => {
        const app2 = new Application({ port: 0 });
        const metricsPlugin = plugins.metrics({ path: '/stats' });
        await app2.plugin(metricsPlugin);
        const server2 = await app2.listen();

        const port = server2?.address()?.port;
        const response = await fetch(`http://localhost:${port}/stats`);
        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.ok(typeof data.uptime === 'number');

        await app2.close();
      });

      test('should track request count', async () => {
        const port = server?.address()?.port;

        // Get initial metrics
        const response1 = await fetch(`http://localhost:${port}/metrics`);
        const data1 = await response1.json();
        const initialRequests = data1.requests;

        // Make some requests
        await fetch(`http://localhost:${port}/metrics`);
        await fetch(`http://localhost:${port}/metrics`);

        // Check updated metrics
        const response2 = await fetch(`http://localhost:${port}/metrics`);
        const data2 = await response2.json();

        assert.ok(data2.requests > initialRequests);
      });
    });

    describe('bodyParser plugin', () => {
      test('should install bodyParser plugin', async () => {
        const app = new Application({ port: 0 });
        const bodyPlugin = plugins.bodyParser();
        await app.plugin(bodyPlugin);
        assert.strictEqual(bodyPlugin.name, 'body-parser');
      });

      test('should work as middleware', async () => {
        const app = new Application({ port: 0 });
        const bodyPlugin = plugins.bodyParser();
        await app.plugin(bodyPlugin);

        app.post('/test', (req, res) => {
          res.json({ received: req.body });
        });

        const server = await app.listen();
        const port = server?.address()?.port;

        const response = await fetch(`http://localhost:${port}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        });

        const data = await response.json();
        assert.deepStrictEqual(data.received, { test: 'data' });

        await app.close();
      });
    });
  });

  describe('Plugin installation', () => {
    test('should install plugin and execute install method', async () => {
      let installed = false;

      const plugin: Plugin = {
        name: 'custom',
        install: async () => {
          installed = true;
        },
      };

      const app = new Application({ port: 0 });
      await app.plugin(plugin);

      assert.strictEqual(installed, true);
    });

    test('should install multiple plugins', async () => {
      const app = new Application({ port: 0 });

      const plugin1: Plugin = {
        name: 'plugin1',
        install: async () => {},
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        install: async () => {},
      };

      await app.plugin(plugin1);
      await app.plugin(plugin2);

      assert.ok(app);
    });

    test('should pass app instance to plugin install', async () => {
      let receivedApp: unknown = null;

      const plugin: Plugin = {
        name: 'check-app',
        install: async (app) => {
          receivedApp = app;
        },
      };

      const app = new Application({ port: 0 });
      await app.plugin(plugin);

      assert.strictEqual(receivedApp, app);
    });
  });
});
