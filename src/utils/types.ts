import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodSchema } from 'zod';

/**
 * HTTP Methods suportados pelo framework
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/**
 * Parâmetros de rota extraídos da URL
 * Exemplo: /users/:id -> { id: string }
 */
export type RouteParams = Record<string, string>;

/**
 * Query parameters da URL
 * Exemplo: /users?page=1&limit=10 -> { page: string, limit: string }
 */
export type QueryParams = Record<string, string | string[]>;

/**
 * Headers HTTP
 */
export type Headers = Record<string, string | string[] | undefined>;

/**
 * HTTP Status codes úteis
 */
export const HttpStatus = {
  // Success
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Request context personalizado que será usado no framework
 */
export interface RequestContext {
  method: HttpMethod;
  url: string;
  path: string;
  params: RouteParams;
  query: QueryParams;
  headers: Headers;
  body?: unknown;
  raw: IncomingMessage;
}

/**
 * Response context personalizado
 */
export interface ResponseContext {
  statusCode: number;
  headers: Headers;
  body?: unknown;
  raw: ServerResponse;

  // Helper methods
  status(code: HttpStatusCode): ResponseContext;
  header(name: string, value: string | string[]): ResponseContext;
  json<T = unknown>(data: T): void;
  text(data: string): void;
  html(data: string): void;
  send(data?: unknown): void;
  redirect(url: string, statusCode?: HttpStatusCode): void;
}

/**
 * Handler function - função que processa uma request
 */
export type Handler<
  TParams extends RouteParams = RouteParams,
  TQuery extends QueryParams = QueryParams,
  TBody = unknown,
> = (
  req: RequestContext & { params: TParams; query: TQuery; body: TBody },
  res: ResponseContext,
) => void | Promise<void>;

/**
 * Middleware function - função que pode modificar req/res ou interromper a cadeia
 */
export type Middleware = (
  req: RequestContext,
  res: ResponseContext,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Next function - chama o próximo middleware/handler
 */
export type NextFunction = (error?: Error) => void;

/**
 * Error handler - função para tratar erros
 */
export type ErrorHandler = (
  error: Error,
  req: RequestContext,
  res: ResponseContext,
) => void | Promise<void>;

/**
 * Route definition
 */
export interface Route {
  method: HttpMethod;
  path: string;
  handler: Handler;
  middleware: Middleware[];
  schema?: ValidationSchema;
}

/**
 * Validation schema para request
 */
export interface ValidationSchema {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Type helpers para inferir tipos do schema
 */
export type InferSchemaType<T extends ValidationSchema> = {
  body: T['body'] extends ZodSchema ? T['body']['_output'] : unknown;
  params: T['params'] extends ZodSchema ? T['params']['_output'] : RouteParams;
  query: T['query'] extends ZodSchema ? T['query']['_output'] : QueryParams;
};

/**
 * Plugin interface
 */
export interface Plugin {
  name: string;
  install: (app: unknown) => void | Promise<void>;
}

/**
 * Application options
 */
export interface ApplicationOptions {
  /**
   * Porta do servidor (padrão: 3000)
   */
  port?: number;

  /**
   * Host do servidor (padrão: 'localhost')
   */
  host?: string;

  /**
   * Habilitar logs de debug
   */
  debug?: boolean;

  /**
   * Error handler customizado
   */
  errorHandler?: (error: Error, req: any, res: any) => void | Promise<void>;

  /**
   * Trust proxy headers (X-Forwarded-*)
   */
  trustProxy?: boolean;
}

/**
 * Custom error class para o framework
 */
export class HttpError extends Error {
  constructor(
    public statusCode: HttpStatusCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
    Error.captureStackTrace(this, this.constructor);
  }
}
