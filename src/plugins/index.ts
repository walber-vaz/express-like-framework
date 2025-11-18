import type { Application } from '../core/application.js';
import { cors } from '../security/cors.js';
import { helmet } from '../security/helmet.js';
import { rateLimit } from '../security/rate-limit.js';
import { logger, performanceLogger, requestLogger } from '../utils/logger.js';
import type { Middleware, Plugin } from '../utils/types.js';

/**
 * Plugin builder para facilitar criação de plugins
 */
export class PluginBuilder {
  private _name: string;
  private _middleware: Middleware[] = [];
  private _routes: Array<{
    method: string;
    path: string;
    handler: any;
  }> = [];
  private _onInstall?: (app: Application) => void | Promise<void>;

  constructor(name: string) {
    this._name = name;
  }

  /**
   * Adiciona middleware ao plugin
   */
  public middleware(...middleware: Middleware[]): this {
    this._middleware.push(...middleware);
    return this;
  }

  /**
   * Adiciona rota ao plugin
   */
  public route(method: string, path: string, handler: any): this {
    this._routes.push({ method, path, handler });
    return this;
  }

  /**
   * Callback quando plugin é instalado
   */
  public onInstall(fn: (app: Application) => void | Promise<void>): this {
    this._onInstall = fn;
    return this;
  }

  /**
   * Constrói o plugin
   */
  public build(): Plugin {
    return {
      name: this._name,
      install: async (app: any) => {
        logger.info(`Installing plugin: ${this._name}`);

        // Registra middleware
        for (const mw of this._middleware) {
          app.use(mw);
        }

        // Registra rotas
        for (const route of this._routes) {
          const router = app.getRouter();
          router.addRoute(route.method, route.path, route.handler);
        }

        // Executa callback de instalação
        if (this._onInstall) {
          await this._onInstall(app);
        }

        logger.info(`Plugin installed: ${this._name}`);
      },
    };
  }
}

/**
 * Helper para criar plugin
 */
export function createPlugin(name: string): PluginBuilder {
  return new PluginBuilder(name);
}

/**
 * Built-in plugins
 */
export const plugins = {
  /**
   * Plugin de logging completo
   */
  logging: (options?: {
    includeHeaders?: boolean;
    includeBody?: boolean;
    performanceThreshold?: number;
  }): Plugin => {
    return createPlugin('logging')
      .middleware(
        requestLogger({
          includeHeaders: options?.includeHeaders,
          includeBody: options?.includeBody,
        }),
        performanceLogger({
          threshold: options?.performanceThreshold ?? 1000,
        }),
      )
      .build();
  },

  /**
   * Plugin de segurança completo
   */
  security: (options?: {
    corsOptions?: Parameters<typeof cors>[0];
    helmetOptions?: Parameters<typeof helmet>[0];
    rateLimitOptions?: Parameters<typeof rateLimit>[0];
  }): Plugin => {
    return createPlugin('security')
      .middleware(
        helmet(options?.helmetOptions),
        cors(options?.corsOptions),
        rateLimit(options?.rateLimitOptions),
      )
      .build();
  },

  /**
   * Plugin de health check
   */
  healthCheck: (options?: {
    path?: string;
    customCheck?: () => Promise<{ status: string; details?: unknown }>;
  }): Plugin => {
    const path = options?.path ?? '/health';

    return createPlugin('health-check')
      .onInstall((app: any) => {
        app.get(path, async (req: any, res: any) => {
          if (options?.customCheck) {
            const result = await options.customCheck();
            res.json(result);
          } else {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
          }
        });
      })
      .build();
  },

  /**
   * Plugin de métricas básicas
   */
  metrics: (options?: { path?: string }): Plugin => {
    const path = options?.path ?? '/metrics';
    const metrics = {
      requests: 0,
      errors: 0,
      startTime: Date.now(),
    };

    return createPlugin('metrics')
      .middleware((req, res, next) => {
        metrics.requests++;

        const originalEnd = res.raw.end;
        res.raw.end = function (this: typeof res.raw, ...args: any[]) {
          if (res.raw.statusCode >= 400) {
            metrics.errors++;
          }
          // @ts-expect-error - args spreading is fine here
          return originalEnd.apply(this, args);
        };

        next();
      })
      .onInstall((app: any) => {
        app.get(path, (req: any, res: any) => {
          res.json({
            uptime: Date.now() - metrics.startTime,
            requests: metrics.requests,
            errors: metrics.errors,
            errorRate:
              metrics.requests > 0
                ? (metrics.errors / metrics.requests) * 100
                : 0,
          });
        });
      })
      .build();
  },

  /**
   * Plugin de body parser JSON
   * Nota: O body parsing já é feito automaticamente pela Application.
   * Este plugin existe apenas para compatibilidade com código legado.
   */
  bodyParser: (): Plugin => {
    return createPlugin('body-parser')
      .middleware((req, res, next) => {
        // Body parsing já é automático - apenas passa adiante
        next();
      })
      .build();
  },
};

/**
 * Re-export útil
 */
export type { Plugin, PluginBuilder as PluginBuilderType };
