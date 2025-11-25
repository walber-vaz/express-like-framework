import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { RequestContext, ResponseContext } from '../utils/types.js';

/**
 * Request context storage usando AsyncLocalStorage
 * Permite acessar request/response de qualquer lugar na cadeia async
 */
interface RequestStore {
  id: string;
  req: RequestContext;
  res: ResponseContext;
  startTime: number;
  metadata: Map<string, unknown>;
}

class ContextManager {
  private storage = new AsyncLocalStorage<RequestStore>();

  /**
   * Executa função dentro de um context
   */
  public run(
    req: RequestContext,
    res: ResponseContext,
    fn: () => Promise<void>,
  ): Promise<void> {
    const store: RequestStore = {
      id: randomUUID(),
      req,
      res,
      startTime: Date.now(),
      metadata: new Map(),
    };

    return this.storage.run(store, fn);
  }

  /**
   * Retorna o request context atual
   */
  public getRequest(): RequestContext | undefined {
    return this.storage.getStore()?.req;
  }

  /**
   * Retorna o response context atual
   */
  public getResponse(): ResponseContext | undefined {
    return this.storage.getStore()?.res;
  }

  /**
   * Retorna o request ID atual
   */
  public getRequestId(): string | undefined {
    return this.storage.getStore()?.id;
  }

  /**
   * Retorna o tempo desde o início da request
   */
  public getElapsedTime(): number | undefined {
    const store = this.storage.getStore();
    if (!store) return undefined;

    return Date.now() - store.startTime;
  }

  /**
   * Set metadata no context
   */
  public set(key: string, value: unknown): void {
    const store = this.storage.getStore();
    if (store) {
      store.metadata.set(key, value);
    }
  }

  /**
   * Get metadata do context
   */
  public get<T = unknown>(key: string): T | undefined {
    const store = this.storage.getStore();
    return store?.metadata.get(key) as T | undefined;
  }

  /**
   * Check se estamos dentro de um request context
   */
  public hasContext(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Get store completo
   */
  public getStore(): RequestStore | undefined {
    return this.storage.getStore();
  }
}

/**
 * Instância singleton do context manager
 */
export const context = new ContextManager();

/**
 * Middleware para adicionar request ID aos headers
 */
export function requestIdMiddleware() {
  return (_req: RequestContext, res: ResponseContext, next: () => void) => {
    const requestId = context.getRequestId();
    if (requestId) {
      res.headers['x-request-id'] = requestId;
    }
    next();
  };
}

/**
 * Middleware para logging de performance
 */
export function performanceMiddleware() {
  return (_req: RequestContext, res: ResponseContext, next: () => void) => {
    const elapsed = context.getElapsedTime();
    if (elapsed !== undefined) {
      res.headers['x-response-time'] = `${elapsed}ms`;
    }
    next();
  };
}
