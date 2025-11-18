import type { ErrorHandler, RequestContext, ResponseContext } from './types.js';
import { HttpError, HttpStatus } from './types.js';

/**
 * Error handler padrão com logging e formatação
 */
export function createErrorHandler(options: {
  debug?: boolean;
  logger?: (error: Error, req: RequestContext) => void;
}): ErrorHandler {
  const { debug = false, logger } = options;

  return (error: Error, req: RequestContext, res: ResponseContext) => {
    // Log error
    if (logger) {
      logger(error, req);
    } else {
      console.error(`[ERROR] ${req.method} ${req.path}:`, error);
    }

    // Não faz nada se response já foi enviada
    if (res.raw.headersSent) {
      return;
    }

    // Handle HttpError
    if (error instanceof HttpError) {
      res.raw.statusCode = error.statusCode;
      res.raw.setHeader('content-type', 'application/json');
      res.raw.end(
        JSON.stringify({
          error: error.message,
          statusCode: error.statusCode,
          details: debug ? error.details : undefined,
        }),
      );
      return;
    }

    // Handle generic errors
    res.raw.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    res.raw.setHeader('content-type', 'application/json');
    res.raw.end(
      JSON.stringify({
        error: 'Internal Server Error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: debug ? error.message : undefined,
        stack: debug ? error.stack : undefined,
      }),
    );
  };
}

/**
 * Error handler que envia response HTML
 */
export function createHtmlErrorHandler(options: {
  debug?: boolean;
}): ErrorHandler {
  const { debug = false } = options;

  return (error: Error, req: RequestContext, res: ResponseContext) => {
    if (res.raw.headersSent) {
      return;
    }

    const statusCode =
      error instanceof HttpError
        ? error.statusCode
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      error instanceof HttpError ? error.message : 'Internal Server Error';

    res.raw.statusCode = statusCode;
    res.raw.setHeader('content-type', 'text/html');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Error ${statusCode}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
    }
    h1 { color: #e74c3c; }
    .code { background: #f5f5f5; padding: 10px; border-radius: 4px; }
    pre { background: #2d2d2d; color: #f8f8f8; padding: 15px; border-radius: 4px; overflow: auto; }
  </style>
</head>
<body>
  <h1>Error ${statusCode}</h1>
  <p class="code">${message}</p>
  ${debug ? `<h2>Details</h2><pre>${error.stack || ''}</pre>` : ''}
</body>
</html>
    `;

    res.raw.end(html);
  };
}

/**
 * Async error wrapper para handlers
 */
export function asyncHandler<T extends (...args: any[]) => Promise<void>>(
  fn: T,
): T {
  return ((...args: any[]) => {
    const result = fn(...args);
    if (result && typeof result.catch === 'function') {
      const next = args[2];
      if (next && typeof next === 'function') {
        result.catch(next);
      }
    }
    return result;
  }) as T;
}

/**
 * Cria HttpError helpers
 */
export const createError = {
  badRequest: (message: string, details?: unknown) =>
    new HttpError(HttpStatus.BAD_REQUEST, message, details),

  unauthorized: (message: string = 'Unauthorized', details?: unknown) =>
    new HttpError(HttpStatus.UNAUTHORIZED, message, details),

  forbidden: (message: string = 'Forbidden', details?: unknown) =>
    new HttpError(HttpStatus.FORBIDDEN, message, details),

  notFound: (message: string = 'Not Found', details?: unknown) =>
    new HttpError(HttpStatus.NOT_FOUND, message, details),

  methodNotAllowed: (message: string, details?: unknown) =>
    new HttpError(HttpStatus.METHOD_NOT_ALLOWED, message, details),

  conflict: (message: string, details?: unknown) =>
    new HttpError(HttpStatus.CONFLICT, message, details),

  unprocessable: (message: string, details?: unknown) =>
    new HttpError(HttpStatus.UNPROCESSABLE_ENTITY, message, details),

  tooManyRequests: (message: string = 'Too Many Requests', details?: unknown) =>
    new HttpError(HttpStatus.TOO_MANY_REQUESTS, message, details),

  internal: (message: string = 'Internal Server Error', details?: unknown) =>
    new HttpError(HttpStatus.INTERNAL_SERVER_ERROR, message, details),

  notImplemented: (message: string = 'Not Implemented', details?: unknown) =>
    new HttpError(HttpStatus.NOT_IMPLEMENTED, message, details),

  serviceUnavailable: (
    message: string = 'Service Unavailable',
    details?: unknown,
  ) => new HttpError(HttpStatus.SERVICE_UNAVAILABLE, message, details),
};

/**
 * Error handling middleware wrapper
 */
export function errorBoundary(
  handler: (...args: any[]) => Promise<void>,
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    try {
      await handler(...args);
    } catch (error) {
      const next = args[2];
      if (next && typeof next === 'function') {
        next(error);
      } else {
        throw error;
      }
    }
  };
}
