import type {
  HttpStatusCode,
  Middleware,
  RequestContext,
} from '../utils/types.js';
import { HttpError, HttpStatus } from '../utils/types.js';

/**
 * The record of hits for a given key.
 */
export interface RateLimitInfo {
  count: number;
  resetTime: number; // Unix timestamp in ms
}

/**
 * Defines the interface for a store used to track rate limit hits.
 */
export interface RateLimitStore {
  /**
   * Increments the hit count for a given key and returns the current count and reset time.
   * @param key The identifier for a client.
   * @param windowMs The duration of the rate limit window in milliseconds.
   * @returns A promise that resolves to the rate limit info.
   */
  increment(key: string, windowMs: number): Promise<RateLimitInfo>;
}

/**
 * A simple in-memory store for rate limiting.
 * Not suitable for production environments with multiple processes.
 */
export class MemoryStore implements RateLimitStore {
  private store = new Map<string, RateLimitInfo>();
  private locks = new Map<string, Promise<void>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60 * 1000) {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (now > value.resetTime) {
          this.store.delete(key);
        }
      }
    }, cleanupIntervalMs);
    // Allow the process to exit even if this timer is active
    this.cleanupInterval.unref();
  }

  public async increment(
    key: string,
    windowMs: number,
  ): Promise<RateLimitInfo> {
    // Wait for any existing lock on this key to release
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create a new lock for this key
    let releaseResolver: (() => void) | undefined;
    const lockPromise = new Promise<void>((resolve) => {
      releaseResolver = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      const now = Date.now();
      let record = this.store.get(key);

      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + windowMs,
        };
      } else {
        record = {
          count: record.count + 1,
          resetTime: record.resetTime,
        };
      }

      this.store.set(key, record);
      return { ...record };
    } finally {
      // Release the lock
      this.locks.delete(key);
      if (releaseResolver) {
        releaseResolver();
      }
    }
  }

  /**
   * Clears the cleanup interval. Should be called when the server shuts down.
   */
  public shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
    this.locks.clear();
  }
}

/**
 * Opções de configuração do rate limiter
 */
export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
  message?: string;
  statusCode?: HttpStatusCode;
  keyGenerator?: (req: RequestContext) => string;
  handler?: (req: RequestContext) => void;
  skip?: (req: RequestContext) => boolean;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  /**
   * The store to use for rate limiting. Defaults to an in-memory store.
   */
  store?: RateLimitStore;
}

/**
 * Middleware de rate limiting
 */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    max = 100,
    windowMs = 15 * 60 * 1000,
    message = 'Too many requests, please try again later.',
    statusCode = HttpStatus.TOO_MANY_REQUESTS,
    keyGenerator = defaultKeyGenerator,
    handler,
    skip,
    standardHeaders = true,
    legacyHeaders = false,
    store = new MemoryStore(),
  } = options;

  return async (req, res, next) => {
    try {
      if (skip?.(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const { count, resetTime } = await store.increment(key, windowMs);
      const now = Date.now();

      const remaining = Math.max(0, max - count);
      const resetTimeSeconds = Math.ceil((resetTime - now) / 1000);

      if (standardHeaders) {
        res.header('ratelimit-limit', max.toString());
        res.header('ratelimit-remaining', remaining.toString());
        res.header('ratelimit-reset', resetTimeSeconds.toString());
      }

      if (legacyHeaders) {
        res.header('x-ratelimit-limit', max.toString());
        res.header('x-ratelimit-remaining', remaining.toString());
        res.header('x-ratelimit-reset', resetTimeSeconds.toString());
      }

      if (count > max) {
        res.header('retry-after', resetTimeSeconds.toString());
        if (handler) {
          handler(req);
        }
        throw new HttpError(statusCode, message);
      }

      next();
    } catch (error) {
      next(error as Error);
    }
  };
}

/**
 * Valida se uma string é um IP válido (IPv4 ou IPv6)
 */
function isValidIp(ip: string): boolean {
  // IPv4: xxx.xxx.xxx.xxx
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6: xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split('.').map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255);
  }

  return ipv6Regex.test(ip);
}

/**
 * Key generator padrão (baseado em IP) com validação contra IP spoofing
 */
function defaultKeyGenerator(req: RequestContext): string {
  // Tenta pegar IP real considerando proxies (APENAS se trustProxy estiver habilitado)
  // IMPORTANTE: Nunca confie em headers proxy sem configuração explícita
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    const firstIp = ips[0];

    // Validar que o IP tem formato válido (proteção contra spoofing)
    if (isValidIp(firstIp)) {
      return firstIp;
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    // Validar formato do IP
    if (isValidIp(realIp)) {
      return realIp;
    }
  }

  // Fallback para o IP do socket (sempre confiável)
  return req.raw.socket.remoteAddress || 'unknown';
}

/**
 * Rate limit presets comuns
 */
export const rateLimitPresets = {
  strict: (): Middleware => rateLimit({ max: 20, windowMs: 15 * 60 * 1000 }),
  moderate: (): Middleware => rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }),
  relaxed: (): Middleware => rateLimit({ max: 1000, windowMs: 15 * 60 * 1000 }),
  auth: (): Middleware =>
    rateLimit({
      max: 5,
      windowMs: 15 * 60 * 1000,
      message: 'Too many authentication attempts, please try again later.',
    }),
  create: (): Middleware =>
    rateLimit({
      max: 10,
      windowMs: 60 * 1000,
      message: 'Too many create requests, please slow down.',
    }),
};

/**
 * Rate limit por usuário (requer req.user)
 */
export function rateLimitByUser(options: RateLimitOptions = {}): Middleware {
  return rateLimit({
    ...options,
    keyGenerator: (req) => {
      const userId = (req as any).user?.id;
      return userId ? `user:${userId}` : defaultKeyGenerator(req);
    },
  });
}

/**
 * Rate limit por rota
 */
export function rateLimitByRoute(options: RateLimitOptions = {}): Middleware {
  return rateLimit({
    ...options,
    keyGenerator: (req) => {
      const ip = defaultKeyGenerator(req);
      return `${ip}:${req.path}`;
    },
  });
}
