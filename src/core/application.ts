import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type {
  ApplicationOptions,
  Handler,
  InferSchemaType,
  Middleware,
  Plugin,
  RequestContext,
  ResponseContext,
  ValidationSchema,
} from '../utils/types.js';
import { HttpError, HttpStatus } from '../utils/types.js';
import { formatValidationErrorForHttp } from '../validation/index.js';
import { MiddlewareChain } from './middleware.js';
import { Request } from './request.js';
import { Response } from './response.js';
import { Router } from './router.js';

/**
 * Application class principal do framework
 */
export class Application {
  private router: Router;
  private server: Server | null = null;
  private _options: Required<ApplicationOptions>;
  private plugins: Plugin[] = [];
  private globalMiddleware: MiddlewareChain;
  private started = false;

  constructor(options: ApplicationOptions = {}) {
    this.router = new Router();
    this.globalMiddleware = new MiddlewareChain();

    this._options = {
      port: options.port ?? 3000,
      host: options.host ?? 'localhost',
      debug: options.debug ?? false,
      trustProxy: options.trustProxy ?? false,
      maxBodySize: options.maxBodySize ?? 10 * 1024 * 1024, // 10MB default
      errorHandler:
        options.errorHandler ?? this._defaultErrorHandler.bind(this),
    };
  }

  /**
   * Registra middleware global
   */
  public use(middleware: Middleware): this {
    this.globalMiddleware.use(middleware);
    return this;
  }

  /**
   * Registra um plugin
   */
  public async plugin(plugin: Plugin): Promise<this> {
    this.plugins.push(plugin);
    await plugin.install(this);
    return this;
  }

  /**
   * Atalhos para rotas HTTP
   */
  // Overload com schema: tipos inferidos automaticamente
  public get<TSchema extends ValidationSchema>(
    path: string,
    handler: Handler<
      InferSchemaType<TSchema>['params'],
      InferSchemaType<TSchema>['query'],
      InferSchemaType<TSchema>['body']
    >,
    options: { middleware?: Middleware[]; schema: TSchema },
  ): this;
  // Overload sem schema: tipos genéricos
  public get(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this;
  // Implementação
  public get(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.get(path, handler, options);
    return this;
  }

  // Overload com schema: tipos inferidos automaticamente
  public post<TSchema extends ValidationSchema>(
    path: string,
    handler: Handler<
      InferSchemaType<TSchema>['params'],
      InferSchemaType<TSchema>['query'],
      InferSchemaType<TSchema>['body']
    >,
    options: { middleware?: Middleware[]; schema: TSchema },
  ): this;
  // Overload sem schema: tipos genéricos
  public post(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this;
  // Implementação
  public post(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.post(path, handler, options);
    return this;
  }

  // Overload com schema: tipos inferidos automaticamente
  public put<TSchema extends ValidationSchema>(
    path: string,
    handler: Handler<
      InferSchemaType<TSchema>['params'],
      InferSchemaType<TSchema>['query'],
      InferSchemaType<TSchema>['body']
    >,
    options: { middleware?: Middleware[]; schema: TSchema },
  ): this;
  // Overload sem schema: tipos genéricos
  public put(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this;
  // Implementação
  public put(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.put(path, handler, options);
    return this;
  }

  // Overload com schema: tipos inferidos automaticamente
  public patch<TSchema extends ValidationSchema>(
    path: string,
    handler: Handler<
      InferSchemaType<TSchema>['params'],
      InferSchemaType<TSchema>['query'],
      InferSchemaType<TSchema>['body']
    >,
    options: { middleware?: Middleware[]; schema: TSchema },
  ): this;
  // Overload sem schema: tipos genéricos
  public patch(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this;
  // Implementação
  public patch(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.patch(path, handler, options);
    return this;
  }

  public delete(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.delete(path, handler, options);
    return this;
  }

  public head(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.head(path, handler, options);
    return this;
  }

  public options(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    this.router.options(path, handler, options);
    return this;
  }

  /**
   * Acessa o router diretamente
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Handle HTTP request
   */
  private async _handleRequest(
    rawReq: IncomingMessage,
    rawRes: ServerResponse,
  ): Promise<void> {
    const req = new Request(rawReq, this._options.maxBodySize);
    const res = new Response(rawRes);

    try {
      // Parse body se necessário
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        await req.parseBody();
      }

      // Debug log
      if (this._options.debug) {
        console.log(`[${req.method}] ${req.path}`);
      }

      // Executa middleware global
      await this.globalMiddleware.execute(req, res);

      // Se resposta já foi enviada por middleware, para aqui
      if (res.finished) {
        return;
      }

      // Tenta fazer match da rota
      const match = this.router.match(req.method, req.path);

      switch (match.status) {
        case 'MATCH': {
          // Adiciona params à request
          req.params = match.params;

          // Valida schema se existir
          if (match.route.schema) {
            await this._validateSchema(req, match.route.schema);
          }

          // Executa middleware da rota
          if (match.route.middleware.length > 0) {
            const routeMiddleware = new MiddlewareChain();
            routeMiddleware.useMany(match.route.middleware);
            await routeMiddleware.execute(req, res);
          }

          // Se resposta já foi enviada por middleware, para aqui
          if (res.finished) {
            return;
          }

          // Executa handler
          await match.route.handler(req, res);
          break;
        }

        case 'METHOD_NOT_ALLOWED': {
          const allowedMethods = match.allowedMethods ?? [];
          res.header('allow', allowedMethods.join(', '));
          throw new HttpError(
            HttpStatus.METHOD_NOT_ALLOWED,
            `Method ${req.method} not allowed`,
            { allowedMethods },
          );
        }

        case 'NOT_FOUND': {
          throw new HttpError(
            HttpStatus.NOT_FOUND,
            `Route ${req.path} not found`,
          );
        }
      }

      // Se handler não enviou resposta, envia 204
      if (!res.finished) {
        res.status(HttpStatus.NO_CONTENT).send();
      }
    } catch (error) {
      await this._handleError(error as Error, req, res);
    }
  }

  /**
   * Valida schema da request com mensagens HTTP-friendly
   */
  private async _validateSchema(
    req: Request,
    schema: ValidationSchema,
  ): Promise<void> {
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        const formatted = formatValidationErrorForHttp(result.error);
        throw new HttpError(
          HttpStatus.BAD_REQUEST,
          formatted.message,
          formatted.errors,
        );
      }
      req.body = result.data;
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        const formatted = formatValidationErrorForHttp(result.error);
        throw new HttpError(
          HttpStatus.BAD_REQUEST,
          formatted.message,
          formatted.errors,
        );
      }
      req.params = result.data;
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        const formatted = formatValidationErrorForHttp(result.error);
        throw new HttpError(
          HttpStatus.BAD_REQUEST,
          formatted.message,
          formatted.errors,
        );
      }
      req.query = result.data;
    }

    if (schema.headers) {
      const result = schema.headers.safeParse(req.headers);
      if (!result.success) {
        const formatted = formatValidationErrorForHttp(result.error);
        throw new HttpError(
          HttpStatus.BAD_REQUEST,
          formatted.message,
          formatted.errors,
        );
      }
      req.headers = result.data;
    }
  }

  /**
   * Handle errors
   */
  private async _handleError(
    error: Error,
    req: Request,
    res: Response,
  ): Promise<void> {
    if (res.finished) {
      return;
    }

    try {
      await this._options.errorHandler(error, req, res);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      this._defaultErrorHandler(error, req, res);
    }
  }

  /**
   * Default error handler
   */
  private _defaultErrorHandler(
    error: Error,
    req: RequestContext,
    res: ResponseContext,
  ): void {
    if (res.finished) {
      return;
    }

    // Log error
    console.error(`[ERROR] ${req.method} ${req.path}:`, error);

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: error.message,
        statusCode: error.statusCode,
        details: this._options.debug ? error.details : undefined,
      });
    } else {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this._options.debug ? error.message : undefined,
        stack: this._options.debug ? error.stack : undefined,
      });
    }
  }

  /**
   * Inicia o servidor
   */
  public async listen(port?: number, host?: string): Promise<Server> {
    if (this.started) {
      throw new Error('Server already started');
    }

    const finalPort = port ?? this._options.port;
    const finalHost = host ?? this._options.host;

    this.server = createServer((req, res) => {
      this._handleRequest(req, res).catch((error) => {
        console.error('Unhandled error in request handler:', error);
      });
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(finalPort, finalHost, () => {
        this.started = true;
        console.log(`Server listening on http://${finalHost}:${finalPort}`);
        resolve(this.server!);
      });

      this.server!.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Para o servidor
   */
  public async close(): Promise<void> {
    if (!this.server || !this.started) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.started = false;
          console.log('Server closed');
          resolve();
        }
      });
    });
  }

  /**
   * Retorna o servidor HTTP nativo
   */
  public getServer(): Server | null {
    return this.server;
  }

  /**
   * Retorna as opções da aplicação
   */
  public getOptions(): Required<ApplicationOptions> {
    return { ...this._options };
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.started;
  }
}
