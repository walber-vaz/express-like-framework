import type { Middleware } from '../utils/types.js';

/**
 * Opções de configuração do Helmet
 */
export interface HelmetOptions {
  /**
   * Content Security Policy
   */
  contentSecurityPolicy?:
    | false
    | {
        directives?: Record<string, string[]>;
      };

  /**
   * X-DNS-Prefetch-Control
   */
  dnsPrefetchControl?: false | { allow?: boolean };

  /**
   * X-Frame-Options
   */
  frameguard?: false | { action?: 'deny' | 'sameorigin' };

  /**
   * Hide X-Powered-By
   */
  hidePoweredBy?: boolean;

  /**
   * Strict-Transport-Security
   */
  hsts?:
    | false
    | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      };

  /**
   * X-Content-Type-Options
   */
  noSniff?: boolean;

  /**
   * X-Permitted-Cross-Domain-Policies
   */
  permittedCrossDomainPolicies?: false | { permittedPolicies?: string };

  /**
   * Referrer-Policy
   */
  referrerPolicy?: false | { policy?: string };

  /**
   * X-XSS-Protection
   */
  xssFilter?: boolean;
}

/**
 * Middleware para adicionar security headers (inspirado no helmet.js)
 */
export function helmet(options: HelmetOptions = {}): Middleware {
  const {
    contentSecurityPolicy,
    dnsPrefetchControl = { allow: false },
    frameguard = { action: 'sameorigin' },
    hidePoweredBy = true,
    hsts = { maxAge: 15552000, includeSubDomains: true },
    noSniff = true,
    permittedCrossDomainPolicies = { permittedPolicies: 'none' },
    referrerPolicy = { policy: 'no-referrer' },
    xssFilter = true,
  } = options;

  return (req, res, next) => {
    // Hide X-Powered-By
    if (hidePoweredBy) {
      delete res.headers['x-powered-by'];
    }

    // X-DNS-Prefetch-Control
    if (dnsPrefetchControl) {
      res.headers['x-dns-prefetch-control'] = dnsPrefetchControl.allow
        ? 'on'
        : 'off';
    }

    // X-Frame-Options
    if (frameguard) {
      res.headers['x-frame-options'] =
        frameguard.action === 'deny' ? 'DENY' : 'SAMEORIGIN';
    }

    // Strict-Transport-Security (HSTS)
    if (hsts) {
      let hstsHeader = `max-age=${hsts.maxAge ?? 15552000}`;
      if (hsts.includeSubDomains) {
        hstsHeader += '; includeSubDomains';
      }
      if (hsts.preload) {
        hstsHeader += '; preload';
      }
      res.headers['strict-transport-security'] = hstsHeader;
    }

    // X-Content-Type-Options
    if (noSniff) {
      res.headers['x-content-type-options'] = 'nosniff';
    }

    // X-Permitted-Cross-Domain-Policies
    if (permittedCrossDomainPolicies) {
      res.headers['x-permitted-cross-domain-policies'] =
        permittedCrossDomainPolicies.permittedPolicies ?? 'none';
    }

    // Referrer-Policy
    if (referrerPolicy) {
      res.headers['referrer-policy'] = referrerPolicy.policy ?? 'no-referrer';
    }

    // X-XSS-Protection
    if (xssFilter) {
      res.headers['x-xss-protection'] = '1; mode=block';
    }

    // Content-Security-Policy
    if (contentSecurityPolicy) {
      const directives = contentSecurityPolicy.directives ?? {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'font-src': ["'self'", 'https:', 'data:'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'object-src': ["'none'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        'upgrade-insecure-requests': [],
      };

      const cspHeader = Object.entries(directives)
        .map(([key, values]) =>
          values.length > 0 ? `${key} ${values.join(' ')}` : key,
        )
        .join('; ');

      res.headers['content-security-policy'] = cspHeader;
    }

    next();
  };
}

/**
 * Helmet presets
 */
export const helmetPresets = {
  /**
   * Configuração padrão recomendada
   */
  default: (): Middleware => helmet(),

  /**
   * Configuração estrita para produção
   */
  strict: (): Middleware =>
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'font-src': ["'self'", 'https:', 'data:'],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'img-src': ["'self'", 'data:'],
          'object-src': ["'none'"],
          'script-src': ["'self'"],
          'script-src-attr': ["'none'"],
          'style-src': ["'self'"],
          'upgrade-insecure-requests': [],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 ano
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
    }),

  /**
   * Configuração relaxada para desenvolvimento
   */
  development: (): Middleware =>
    helmet({
      contentSecurityPolicy: false,
      hsts: false,
    }),

  /**
   * Apenas headers básicos (sem CSP)
   */
  minimal: (): Middleware =>
    helmet({
      contentSecurityPolicy: false,
    }),
};
