import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  asyncHandler,
  createError,
  createErrorHandler,
  createHtmlErrorHandler,
  errorBoundary,
} from '../../src/utils/error-handler.js';
import type { RequestContext, ResponseContext } from '../../src/utils/types.js';
import { HttpError, HttpStatus } from '../../src/utils/types.js';

describe('Error Handler', () => {
  describe('createError helpers', () => {
    test('should create badRequest error', () => {
      const error = createError.badRequest('Invalid input');
      assert.ok(error instanceof HttpError);
      assert.strictEqual(error.statusCode, HttpStatus.BAD_REQUEST);
      assert.strictEqual(error.message, 'Invalid input');
    });

    test('should create badRequest error with details', () => {
      const details = { field: 'email', issue: 'invalid format' };
      const error = createError.badRequest('Invalid input', details);
      assert.strictEqual(error.details, details);
    });

    test('should create unauthorized error', () => {
      const error = createError.unauthorized();
      assert.strictEqual(error.statusCode, HttpStatus.UNAUTHORIZED);
      assert.strictEqual(error.message, 'Unauthorized');
    });

    test('should create unauthorized error with custom message', () => {
      const error = createError.unauthorized('Invalid token');
      assert.strictEqual(error.message, 'Invalid token');
    });

    test('should create forbidden error', () => {
      const error = createError.forbidden();
      assert.strictEqual(error.statusCode, HttpStatus.FORBIDDEN);
      assert.strictEqual(error.message, 'Forbidden');
    });

    test('should create forbidden error with custom message', () => {
      const error = createError.forbidden('Access denied');
      assert.strictEqual(error.message, 'Access denied');
    });

    test('should create notFound error', () => {
      const error = createError.notFound();
      assert.strictEqual(error.statusCode, HttpStatus.NOT_FOUND);
      assert.strictEqual(error.message, 'Not Found');
    });

    test('should create notFound error with custom message', () => {
      const error = createError.notFound('User not found');
      assert.strictEqual(error.message, 'User not found');
    });

    test('should create methodNotAllowed error', () => {
      const error = createError.methodNotAllowed('Method not allowed');
      assert.strictEqual(error.statusCode, HttpStatus.METHOD_NOT_ALLOWED);
      assert.strictEqual(error.message, 'Method not allowed');
    });

    test('should create conflict error', () => {
      const error = createError.conflict('Resource already exists');
      assert.strictEqual(error.statusCode, HttpStatus.CONFLICT);
      assert.strictEqual(error.message, 'Resource already exists');
    });

    test('should create unprocessable error', () => {
      const error = createError.unprocessable('Validation failed');
      assert.strictEqual(error.statusCode, HttpStatus.UNPROCESSABLE_ENTITY);
      assert.strictEqual(error.message, 'Validation failed');
    });

    test('should create tooManyRequests error', () => {
      const error = createError.tooManyRequests();
      assert.strictEqual(error.statusCode, HttpStatus.TOO_MANY_REQUESTS);
      assert.strictEqual(error.message, 'Too Many Requests');
    });

    test('should create internal error', () => {
      const error = createError.internal();
      assert.strictEqual(error.statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
      assert.strictEqual(error.message, 'Internal Server Error');
    });

    test('should create notImplemented error', () => {
      const error = createError.notImplemented();
      assert.strictEqual(error.statusCode, HttpStatus.NOT_IMPLEMENTED);
      assert.strictEqual(error.message, 'Not Implemented');
    });

    test('should create serviceUnavailable error', () => {
      const error = createError.serviceUnavailable();
      assert.strictEqual(error.statusCode, HttpStatus.SERVICE_UNAVAILABLE);
      assert.strictEqual(error.message, 'Service Unavailable');
    });
  });

  describe('createErrorHandler', () => {
    test('should handle HttpError correctly', () => {
      const handler = createErrorHandler({ debug: false });
      const error = new HttpError(400, 'Bad Request', { foo: 'bar' });

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      assert.strictEqual(res.raw.statusCode, 400);
      const parsed = JSON.parse(responseBody);
      assert.strictEqual(parsed.error, 'Bad Request');
      assert.strictEqual(parsed.statusCode, 400);
      assert.strictEqual(parsed.details, undefined); // debug is false
    });

    test('should include details when debug is true', () => {
      const handler = createErrorHandler({ debug: true });
      const error = new HttpError(400, 'Bad Request', { foo: 'bar' });

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      const parsed = JSON.parse(responseBody);
      assert.deepStrictEqual(parsed.details, { foo: 'bar' });
    });

    test('should handle generic errors', () => {
      const handler = createErrorHandler({ debug: false });
      const error = new Error('Something went wrong');

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      assert.strictEqual(res.raw.statusCode, 500);
      const parsed = JSON.parse(responseBody);
      assert.strictEqual(parsed.error, 'Internal Server Error');
      assert.strictEqual(parsed.statusCode, 500);
      assert.strictEqual(parsed.message, undefined);
      assert.strictEqual(parsed.stack, undefined);
    });

    test('should include stack when debug is true for generic errors', () => {
      const handler = createErrorHandler({ debug: true });
      const error = new Error('Something went wrong');

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      const parsed = JSON.parse(responseBody);
      assert.strictEqual(parsed.message, 'Something went wrong');
      assert.ok(parsed.stack);
    });

    test('should not send response if headers already sent', () => {
      const handler = createErrorHandler({ debug: false });
      const error = new Error('Test');

      let endCalled = false;
      const res = {
        raw: {
          headersSent: true,
          end: () => {
            endCalled = true;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);
      assert.strictEqual(endCalled, false);
    });

    test('should use custom logger when provided', () => {
      let loggedError: Error | null = null;
      let loggedReq: RequestContext | null = null;

      const handler = createErrorHandler({
        logger: (error, req) => {
          loggedError = error;
          loggedReq = req;
        },
      });

      const error = new Error('Test error');
      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: () => {},
        },
      } as unknown as ResponseContext;

      handler(error, req, res);

      assert.strictEqual(loggedError, error);
      assert.strictEqual(loggedReq, req);
    });
  });

  describe('createHtmlErrorHandler', () => {
    test('should handle HttpError and return HTML', () => {
      const handler = createHtmlErrorHandler({ debug: false });
      const error = new HttpError(404, 'Not Found');

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      assert.strictEqual(res.raw.statusCode, 404);
      assert.ok(responseBody.includes('<!DOCTYPE html>'));
      assert.ok(responseBody.includes('Error 404'));
      assert.ok(responseBody.includes('Not Found'));
    });

    test('should include stack when debug is true', () => {
      const handler = createHtmlErrorHandler({ debug: true });
      const error = new Error('Test error');

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      assert.ok(responseBody.includes('<h2>Details</h2>'));
      assert.ok(responseBody.includes('<pre>'));
    });

    test('should not include stack when debug is false', () => {
      const handler = createHtmlErrorHandler({ debug: false });
      const error = new Error('Test error');

      let responseBody = '';
      const res = {
        raw: {
          headersSent: false,
          statusCode: 0,
          setHeader: () => {},
          end: (body: string) => {
            responseBody = body;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);

      assert.ok(!responseBody.includes('<h2>Details</h2>'));
    });

    test('should not send response if headers already sent', () => {
      const handler = createHtmlErrorHandler({ debug: false });
      const error = new Error('Test');

      let endCalled = false;
      const res = {
        raw: {
          headersSent: true,
          end: () => {
            endCalled = true;
          },
        },
      } as unknown as ResponseContext;

      const req = {
        method: 'GET',
        path: '/test',
      } as RequestContext;

      handler(error, req, res);
      assert.strictEqual(endCalled, false);
    });
  });

  describe('asyncHandler', () => {
    test('should wrap async function', () => {
      const handler = asyncHandler(
        async (
          _req: unknown,
          _res: unknown,
          _next: () => void,
        ): Promise<void> => {},
      );

      assert.strictEqual(typeof handler, 'function');
    });

    test('should work with successful async handlers', async () => {
      let executed = false;
      const handler = asyncHandler(
        async (
          _req: unknown,
          _res: unknown,
          _next: () => void,
        ): Promise<void> => {
          executed = true;
        },
      );

      await handler({}, {}, () => {});
      assert.strictEqual(executed, true);
    });
  });

  describe('errorBoundary', () => {
    test('should catch errors and pass to next', async () => {
      let caughtError: Error | null = null;
      const next = (err: Error) => {
        caughtError = err;
      };

      const handler = errorBoundary(async () => {
        throw new Error('Boundary error');
      });

      await handler({}, {}, next);

      assert.ok(caughtError);
      assert.strictEqual(caughtError?.message, 'Boundary error');
    });

    test('should rethrow if no next function provided', async () => {
      const handler = errorBoundary(async () => {
        throw new Error('Boundary error');
      });

      await assert.rejects(
        async () => {
          await handler({}, {});
        },
        {
          message: 'Boundary error',
        },
      );
    });

    test('should work with successful handlers', async () => {
      let executed = false;
      const handler = errorBoundary(async () => {
        executed = true;
      });

      await handler({}, {}, () => {});
      assert.strictEqual(executed, true);
    });
  });
});
