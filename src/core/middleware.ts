import type {
  Middleware,
  NextFunction,
  RequestContext,
  ResponseContext,
} from '../utils/types.js';

/**
 * Middleware chain executor
 * Executa uma lista de middlewares em ordem, permitindo async/await
 */
export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  /**
   * Adiciona um middleware à cadeia
   */
  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Adiciona múltiplos middlewares de uma vez
   */
  public useMany(middlewares: Middleware[]): this {
    this.middlewares.push(...middlewares);
    return this;
  }

  /**
   * Executa a cadeia de middlewares
   */
  public async execute(
    req: RequestContext,
    res: ResponseContext,
  ): Promise<void> {
    let index = 0;
    let error: Error | undefined;

    const next: NextFunction = (err?: Error) => {
      if (err) {
        error = err;
        return;
      }
      index++;
    };

    while (index < this.middlewares.length && !error) {
      const middleware = this.middlewares[index];
      const currentIndex = index;

      try {
        await middleware(req, res, next);

        // Se next() não foi chamado, interrompemos a cadeia
        if (index === currentIndex) {
          break;
        }
      } catch (err) {
        error = err as Error;
        break;
      }
    }

    if (error) {
      throw error;
    }
  }

  /**
   * Retorna o número de middlewares na cadeia
   */
  public get length(): number {
    return this.middlewares.length;
  }

  /**
   * Limpa todos os middlewares
   */
  public clear(): void {
    this.middlewares = [];
  }
}

/**
 * Compose múltiplos middlewares em um único middleware
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return async (
    req: RequestContext,
    res: ResponseContext,
    next: NextFunction,
  ) => {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index >= middlewares.length) {
        next();
        return;
      }

      const middleware = middlewares[index++];

      await middleware(req, res, () => {
        return dispatch();
      });
    };

    await dispatch();
  };
}

/**
 * Create middleware from async function
 */
export function createMiddleware(
  fn: (req: RequestContext, res: ResponseContext) => Promise<void> | void,
): Middleware {
  return async (
    req: RequestContext,
    res: ResponseContext,
    next: NextFunction,
  ) => {
    await fn(req, res);
    next();
  };
}

/**
 * Conditional middleware - só executa se condition for true
 */
export function conditional(
  condition: (req: RequestContext) => boolean,
  middleware: Middleware,
): Middleware {
  return (req: RequestContext, res: ResponseContext, next: NextFunction) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
}

/**
 * Middleware para métodos HTTP específicos
 */
export function onlyMethods(
  methods: string[],
  middleware: Middleware,
): Middleware {
  const upperMethods = methods.map((m) => m.toUpperCase());

  return conditional(
    (req) => upperMethods.includes(req.method.toUpperCase()),
    middleware,
  );
}

/**
 * Middleware para paths específicos (regex ou string)
 */
export function onlyPaths(
  pattern: string | RegExp,
  middleware: Middleware,
): Middleware {
  const regex =
    typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;

  return conditional((req) => regex.test(req.path), middleware);
}
