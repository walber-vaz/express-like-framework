import FindMyWay from 'find-my-way';
import type {
  Handler,
  HttpMethod,
  Middleware,
  Route,
  RouteParams,
  ValidationSchema,
} from '../utils/types.js';

/**
 * Interface for the data stored with each route in find-my-way.
 */
interface RouteStore {
  path: string;
  handler: Handler;
  middleware: Middleware[];
  schema?: ValidationSchema;
}

/**
 * Route match result for a successful match.
 */
export interface RouteMatchSuccess {
  status: 'MATCH';
  route: Route;
  params: RouteParams;
}

/**
 * Route match result for a failed match.
 */
export interface RouteMatchFailure {
  status: 'NOT_FOUND' | 'METHOD_NOT_ALLOWED';
  allowedMethods?: HttpMethod[];
}

export type RouteMatchResult = RouteMatchSuccess | RouteMatchFailure;

/**
 * Router para gerenciar rotas e fazer pattern matching usando find-my-way.
 */
export class Router {
  private fmw: FindMyWay.Instance<FindMyWay.HTTPVersion.V1>;
  private globalMiddleware: Middleware[] = [];
  private routeCounter = 0;

  constructor() {
    this.fmw = FindMyWay({
      allowUnsafeRegex: true,
      caseSensitive: false,
      ignoreTrailingSlash: true,
      defaultRoute: () => {},
    });
  }

  /**
   * Registra um middleware global (aplicado a todas as rotas)
   */
  public use(middleware: Middleware): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Registra uma rota
   */
  public addRoute(
    method: HttpMethod | HttpMethod[],
    path: string,
    handler: Handler,
    options: {
      middleware?: Middleware[];
      schema?: ValidationSchema;
    } = {},
  ): this {
    const store: RouteStore = {
      path,
      handler,
      middleware: options.middleware || [],
      schema: options.schema,
    };

    // Cast handler to `any` to satisfy find-my-way's strict typing.
    // This is safe because fmw only stores the handler, it doesn't execute it.
    // The actual execution happens in `application.ts` with the correct types.
    this.fmw.on(method, path, handler as any, store);
    this.routeCounter++;
    return this;
  }

  /**
   * Atalhos para métodos HTTP
   */
  public get(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('GET', path, handler, options);
  }

  public post(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('POST', path, handler, options);
  }

  public put(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('PUT', path, handler, options);
  }

  public patch(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('PATCH', path, handler, options);
  }

  public delete(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('DELETE', path, handler, options);
  }

  public head(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('HEAD', path, handler, options);
  }

  public options(
    path: string,
    handler: Handler,
    options?: { middleware?: Middleware[]; schema?: ValidationSchema },
  ): this {
    return this.addRoute('OPTIONS', path, handler, options);
  }

  /**
   * Encontra uma rota que corresponde ao método e path
   */
  public match(method: HttpMethod, path: string): RouteMatchResult {
    const match = this.fmw.find(method as FindMyWay.HTTPMethod, path);

    if (!match) {
      // Se find-my-way não encontrou, verificamos se o path existe com outro método.
      const allowedMethods = this.getAllowedMethods(path);
      if (allowedMethods.length > 0) {
        return {
          status: 'METHOD_NOT_ALLOWED',
          allowedMethods,
        };
      }
      return { status: 'NOT_FOUND' };
    }

    const { params, store } = match;
    const routeStore = store as RouteStore;

    return {
      status: 'MATCH',
      route: {
        method: method.toUpperCase() as HttpMethod,
        path: routeStore.path,
        handler: routeStore.handler,
        // Combina middleware global com middleware da rota
        middleware: [...this.globalMiddleware, ...routeStore.middleware],
        schema: routeStore.schema,
      },
      params,
    };
  }

  /**
   * Retorna todos os métodos HTTP disponíveis para um path.
   * NOTA: find-my-way não otimiza para isso. A implementação é para compatibilidade.
   */
  public getAllowedMethods(path: string): HttpMethod[] {
    const methods: HttpMethod[] = [];
    const supportedMethods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ];

    for (const method of supportedMethods) {
      const match = this.fmw.find(method, path);
      if (match) {
        methods.push(method);
      }
    }

    return [...new Set(methods)];
  }

  /**
   * Retorna todas as rotas registradas (aproximação)
   */
  public getRoutes(): any[] {
    // find-my-way não expõe rotas de forma simples, retorna uma representação do tree.
    // @ts-expect-error - prettyPrint é uma função interna não tipada
    return this.fmw.prettyPrint();
  }

  /**
   * Remove todas as rotas
   */
  public clear(): void {
    this.fmw.reset();
    this.globalMiddleware = [];
    this.routeCounter = 0;
  }

  /**
   * Número de rotas registradas
   */
  public get size(): number {
    return this.routeCounter;
  }
}

/**
 * Route builder para criar rotas de forma fluente
 */
export class RouteBuilder {
  private _path: string;
  private _method?: HttpMethod;
  private _handler?: Handler;
  private _middleware: Middleware[] = [];
  private _schema?: ValidationSchema;

  constructor(path: string) {
    this._path = path;
  }

  public method(method: HttpMethod): this {
    this._method = method;
    return this;
  }

  public get(): this {
    return this.method('GET');
  }

  public post(): this {
    return this.method('POST');
  }

  public put(): this {
    return this.method('PUT');
  }

  public patch(): this {
    return this.method('PATCH');
  }

  public delete(): this {
    return this.method('DELETE');
  }

  public handler(handler: Handler): this {
    this._handler = handler;
    return this;
  }

  public middleware(...middleware: Middleware[]): this {
    this._middleware.push(...middleware);
    return this;
  }

  public schema(schema: ValidationSchema): this {
    this._schema = schema;
    return this;
  }

  public build(): Route {
    if (!this._method) {
      throw new Error('Route method is required');
    }

    if (!this._handler) {
      throw new Error('Route handler is required');
    }

    return {
      method: this._method,
      path: this._path,
      handler: this._handler,
      middleware: this._middleware,
      schema: this._schema,
    };
  }

  public register(router: Router): void {
    const route = this.build();
    router.addRoute(route.method, route.path, route.handler, {
      middleware: route.middleware,
      schema: route.schema,
    });
  }
}
