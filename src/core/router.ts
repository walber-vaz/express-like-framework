import type {
  Handler,
  HttpMethod,
  Middleware,
  Route,
  RouteParams,
  ValidationSchema,
} from '../utils/types.js';

/**
 * Route match result
 */
interface RouteMatch {
  route: Route;
  params: RouteParams;
}

/**
 * Router para gerenciar rotas e fazer pattern matching
 */
export class Router {
  private routes: Route[] = [];
  private globalMiddleware: Middleware[] = [];

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
    method: HttpMethod,
    path: string,
    handler: Handler,
    options: {
      middleware?: Middleware[];
      schema?: ValidationSchema;
    } = {},
  ): this {
    this.routes.push({
      method: method.toUpperCase() as HttpMethod,
      path: this._normalizePath(path),
      handler,
      middleware: options.middleware || [],
      schema: options.schema,
    });

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
  public match(method: HttpMethod, path: string): RouteMatch | null {
    const normalizedPath = this._normalizePath(path);

    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) {
        continue;
      }

      const params = this._matchPath(route.path, normalizedPath);
      if (params !== null) {
        return {
          route: {
            ...route,
            // Combina middleware global com middleware da rota
            middleware: [...this.globalMiddleware, ...route.middleware],
          },
          params,
        };
      }
    }

    return null;
  }

  /**
   * Verifica se existe alguma rota para o path (qualquer método)
   */
  public hasPath(path: string): boolean {
    const normalizedPath = this._normalizePath(path);

    for (const route of this.routes) {
      const params = this._matchPath(route.path, normalizedPath);
      if (params !== null) {
        return true;
      }
    }

    return false;
  }

  /**
   * Retorna todos os métodos HTTP disponíveis para um path
   */
  public getAllowedMethods(path: string): HttpMethod[] {
    const normalizedPath = this._normalizePath(path);
    const methods: HttpMethod[] = [];

    for (const route of this.routes) {
      const params = this._matchPath(route.path, normalizedPath);
      if (params !== null) {
        methods.push(route.method);
      }
    }

    return methods;
  }

  /**
   * Normaliza path (remove trailing slash, garante leading slash)
   */
  private _normalizePath(path: string): string {
    if (!path || path === '/') return '/';

    // Remove trailing slash
    let normalized = path.replace(/\/+$/, '');

    // Garante leading slash
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    return normalized;
  }

  /**
   * Faz match de um pattern contra um path e extrai parâmetros
   * Suporta:
   * - Parâmetros: /users/:id -> /users/123
   * - Wildcard: /files/* -> /files/foo/bar.txt
   * - Optional: /users/:id? -> /users ou /users/123
   */
  private _matchPath(pattern: string, path: string): RouteParams | null {
    // Exact match
    if (pattern === path) {
      return {};
    }

    const params: RouteParams = {};

    // Converte pattern para regex
    let regexPattern = pattern
      // Escape special regex chars except : and *
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      // Named params: :name -> (?<name>[^/]+)
      .replace(/:(\w+)\?/g, '(?<$1>[^/]+)?')
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')
      // Wildcard: * -> .*
      .replace(/\*/g, '.*');

    // Adiciona anchors
    regexPattern = `^${regexPattern}$`;

    const regex = new RegExp(regexPattern);
    const match = path.match(regex);

    if (!match) {
      return null;
    }

    // Extrai named groups como parâmetros
    if (match.groups) {
      Object.assign(params, match.groups);
    }

    return params;
  }

  /**
   * Retorna todas as rotas registradas
   */
  public getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Remove todas as rotas
   */
  public clear(): void {
    this.routes = [];
    this.globalMiddleware = [];
  }

  /**
   * Número de rotas registradas
   */
  public get size(): number {
    return this.routes.length;
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
