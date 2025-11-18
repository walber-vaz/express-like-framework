import type { Middleware, RequestContext } from '../utils/types.js';
import { HttpError, HttpStatus } from '../utils/types.js';

/**
 * Store de rate limit requests
 */
interface RateLimitStore {
  count: number;
  resetTime: number;
}

/**
 * Opções de configuração do rate limiter
 */
export interface RateLimitOptions {
  /**
   * Número máximo de requests permitidas na janela
   */
  max?: number;

  /**
   * Janela de tempo em milissegundos
   */
  windowMs?: number;

  /**
   * Mensagem de erro
   */
  message?: string;

  /**
   * Status code da resposta
   */
  statusCode?: number;

  /**
   * Função para gerar a chave de identificação
   */
  keyGenerator?: (req: RequestContext) => string;

  /**
   * Handler customizado quando limite é excedido
   */
  handler?: (req: RequestContext) => void;

  /**
   * Skip rate limiting baseado em condição
   */
  skip?: (req: RequestContext) => boolean;

  /**
   * Adiciona headers de rate limit na resposta
   */
  standardHeaders?: boolean;

  /**
   * Adiciona headers legacy (X-RateLimit-*)
   */
  legacyHeaders?: boolean;
}

/**
 * Middleware de rate limiting
 * Implementação simples em memória (não adequado para múltiplos processos)
 */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    max = 100,
    windowMs = 15 * 60 * 1000, // 15 minutos
    message = 'Too many requests, please try again later.',
    statusCode = HttpStatus.TOO_MANY_REQUESTS,
    keyGenerator = defaultKeyGenerator,
    handler,
    skip,
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  const store = new Map<string, RateLimitStore>();

  // Cleanup expired entries periodicamente
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    // Skip se função skip retornar true
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = store.get(key);

    // Inicializa ou reseta contador
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    }

    record.count++;

    const remaining = Math.max(0, max - record.count);
    const resetTime = Math.ceil((record.resetTime - now) / 1000);

    // Adiciona headers
    if (standardHeaders) {
      res.headers['ratelimit-limit'] = max.toString();
      res.headers['ratelimit-remaining'] = remaining.toString();
      res.headers['ratelimit-reset'] = resetTime.toString();
    }

    if (legacyHeaders) {
      res.headers['x-ratelimit-limit'] = max.toString();
      res.headers['x-ratelimit-remaining'] = remaining.toString();
      res.headers['x-ratelimit-reset'] = resetTime.toString();
    }

    // Verifica limite
    if (record.count > max) {
      res.headers['retry-after'] = resetTime.toString();

      if (handler) {
        handler(req);
      }

      throw new HttpError(statusCode as any, message);
    }

    next();
  };
}

/**
 * Key generator padrão (baseado em IP)
 */
function defaultKeyGenerator(req: RequestContext): string {
  // Tenta pegar IP real considerando proxies
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const forwardedString = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return forwardedString.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.raw.socket.remoteAddress || 'unknown';
}

/**
 * Rate limit presets comuns
 */
export const rateLimitPresets = {
  /**
   * Limite estrito para APIs públicas
   */
  strict: (): Middleware =>
    rateLimit({
      max: 20,
      windowMs: 15 * 60 * 1000, // 15 minutos
    }),

  /**
   * Limite moderado
   */
  moderate: (): Middleware =>
    rateLimit({
      max: 100,
      windowMs: 15 * 60 * 1000,
    }),

  /**
   * Limite relaxado
   */
  relaxed: (): Middleware =>
    rateLimit({
      max: 1000,
      windowMs: 15 * 60 * 1000,
    }),

  /**
   * Limite para autenticação (previne brute force)
   */
  auth: (): Middleware =>
    rateLimit({
      max: 5,
      windowMs: 15 * 60 * 1000,
      message: 'Too many authentication attempts, please try again later.',
    }),

  /**
   * Limite para criação de recursos
   */
  create: (): Middleware =>
    rateLimit({
      max: 10,
      windowMs: 60 * 1000, // 1 minuto
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
      // Assume que existe um user ID na request
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
