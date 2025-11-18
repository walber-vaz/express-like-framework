import type { Middleware } from '../utils/types.js';
import { HttpStatus } from '../utils/types.js';

/**
 * Opções de configuração do CORS
 */
export interface CorsOptions {
  /**
   * Origins permitidas
   * - string: origin específica
   * - string[]: lista de origins
   * - '*': qualquer origin
   * - RegExp: pattern regex
   * - function: validação customizada
   */
  origin?: string | string[] | RegExp | ((origin: string) => boolean) | '*';

  /**
   * Métodos HTTP permitidos
   */
  methods?: string[];

  /**
   * Headers permitidos
   */
  allowedHeaders?: string[];

  /**
   * Headers expostos ao client
   */
  exposedHeaders?: string[];

  /**
   * Permite credentials (cookies, authorization headers)
   */
  credentials?: boolean;

  /**
   * Tempo de cache da preflight request (em segundos)
   */
  maxAge?: number;

  /**
   * Status code para OPTIONS request
   */
  optionsSuccessStatus?: number;

  /**
   * Executa middleware mesmo para preflight
   */
  preflightContinue?: boolean;
}

/**
 * Middleware CORS configurável
 */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders,
    exposedHeaders,
    credentials = false,
    maxAge = 86400, // 24 horas
    optionsSuccessStatus = HttpStatus.NO_CONTENT,
    preflightContinue = false,
  } = options;

  return (req, res, next) => {
    const requestOrigin = req.headers.origin as string | undefined;

    // Verifica origin
    const allowedOrigin = isOriginAllowed(requestOrigin, origin);

    if (allowedOrigin) {
      res.headers['access-control-allow-origin'] = allowedOrigin;
    }

    // Credentials
    if (credentials) {
      res.headers['access-control-allow-credentials'] = 'true';
    }

    // Exposed headers
    if (exposedHeaders && exposedHeaders.length > 0) {
      res.headers['access-control-expose-headers'] = exposedHeaders.join(', ');
    }

    // Preflight request
    if (req.method === 'OPTIONS') {
      // Methods
      res.headers['access-control-allow-methods'] = methods.join(', ');

      // Headers
      if (allowedHeaders && allowedHeaders.length > 0) {
        res.headers['access-control-allow-headers'] = allowedHeaders.join(', ');
      } else {
        // Echo back requested headers
        const requestHeaders = req.headers['access-control-request-headers'];
        if (requestHeaders) {
          res.headers['access-control-allow-headers'] = Array.isArray(
            requestHeaders,
          )
            ? requestHeaders.join(', ')
            : requestHeaders;
        }
      }

      // Max age
      res.headers['access-control-max-age'] = maxAge.toString();

      // Handle preflight
      if (!preflightContinue) {
        res.raw.statusCode = optionsSuccessStatus;
        res.raw.setHeader('content-length', '0');
        res.raw.end();
        return;
      }
    }

    next();
  };
}

/**
 * Verifica se origin é permitida
 */
function isOriginAllowed(
  requestOrigin: string | undefined,
  allowedOrigin:
    | string
    | string[]
    | RegExp
    | ((origin: string) => boolean)
    | '*',
): string | null {
  if (!requestOrigin) {
    return null;
  }

  // Wildcard
  if (allowedOrigin === '*') {
    return '*';
  }

  // String única
  if (typeof allowedOrigin === 'string') {
    return allowedOrigin === requestOrigin ? requestOrigin : null;
  }

  // Array de strings
  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(requestOrigin) ? requestOrigin : null;
  }

  // RegExp
  if (allowedOrigin instanceof RegExp) {
    return allowedOrigin.test(requestOrigin) ? requestOrigin : null;
  }

  // Função customizada
  if (typeof allowedOrigin === 'function') {
    return allowedOrigin(requestOrigin) ? requestOrigin : null;
  }

  return null;
}

/**
 * CORS presets comuns
 */
export const corsPresets = {
  /**
   * Desenvolvimento local - permite tudo
   */
  development: (): Middleware =>
    cors({
      origin: '*',
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    }),

  /**
   * Produção restrita - apenas origins específicas
   */
  production: (allowedOrigins: string[]): Middleware =>
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      maxAge: 86400,
    }),

  /**
   * API pública - sem credentials
   */
  publicApi: (): Middleware =>
    cors({
      origin: '*',
      credentials: false,
      methods: ['GET', 'HEAD', 'POST'],
    }),
};
