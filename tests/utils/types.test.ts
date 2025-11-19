/**
 * Tests for types and HttpError
 */

import assert from 'node:assert';
import { describe, test } from 'node:test';
import { HttpError, HttpStatus } from '../../dist/utils/types.js';

describe('HttpStatus', () => {
  test('has correct success status codes', () => {
    assert.strictEqual(HttpStatus.OK, 200);
    assert.strictEqual(HttpStatus.CREATED, 201);
    assert.strictEqual(HttpStatus.NO_CONTENT, 204);
  });

  test('has correct redirection status codes', () => {
    assert.strictEqual(HttpStatus.MOVED_PERMANENTLY, 301);
    assert.strictEqual(HttpStatus.FOUND, 302);
    assert.strictEqual(HttpStatus.NOT_MODIFIED, 304);
  });

  test('has correct client error status codes', () => {
    assert.strictEqual(HttpStatus.BAD_REQUEST, 400);
    assert.strictEqual(HttpStatus.UNAUTHORIZED, 401);
    assert.strictEqual(HttpStatus.FORBIDDEN, 403);
    assert.strictEqual(HttpStatus.NOT_FOUND, 404);
    assert.strictEqual(HttpStatus.METHOD_NOT_ALLOWED, 405);
    assert.strictEqual(HttpStatus.CONFLICT, 409);
    assert.strictEqual(HttpStatus.UNPROCESSABLE_ENTITY, 422);
    assert.strictEqual(HttpStatus.TOO_MANY_REQUESTS, 429);
  });

  test('has correct server error status codes', () => {
    assert.strictEqual(HttpStatus.INTERNAL_SERVER_ERROR, 500);
    assert.strictEqual(HttpStatus.NOT_IMPLEMENTED, 501);
    assert.strictEqual(HttpStatus.BAD_GATEWAY, 502);
    assert.strictEqual(HttpStatus.SERVICE_UNAVAILABLE, 503);
  });
});

describe('HttpError', () => {
  test('creates error with status code and message', () => {
    const error = new HttpError(404, 'Not found');

    assert.ok(error instanceof Error);
    assert.ok(error instanceof HttpError);
    assert.strictEqual(error.statusCode, 404);
    assert.strictEqual(error.message, 'Not found');
    assert.strictEqual(error.details, undefined);
  });

  test('creates error with details', () => {
    const details = { field: 'email', reason: 'invalid' };
    const error = new HttpError(400, 'Validation failed', details);

    assert.strictEqual(error.statusCode, 400);
    assert.strictEqual(error.message, 'Validation failed');
    assert.deepStrictEqual(error.details, details);
  });

  test('has correct error name', () => {
    const error = new HttpError(500, 'Server error');
    assert.strictEqual(error.name, 'HttpError');
  });

  test('has stack trace', () => {
    const error = new HttpError(500, 'Server error');
    assert.ok(error.stack);
    assert.ok(error.stack!.includes('HttpError'));
  });

  test('works with different status codes', () => {
    const error400 = new HttpError(400, 'Bad Request');
    const error401 = new HttpError(401, 'Unauthorized');
    const error403 = new HttpError(403, 'Forbidden');
    const error500 = new HttpError(500, 'Internal Server Error');

    assert.strictEqual(error400.statusCode, 400);
    assert.strictEqual(error401.statusCode, 401);
    assert.strictEqual(error403.statusCode, 403);
    assert.strictEqual(error500.statusCode, 500);
  });

  test('preserves details object type', () => {
    interface CustomDetails {
      userId: number;
      action: string;
    }

    const details: CustomDetails = {
      userId: 123,
      action: 'delete',
    };

    const error = new HttpError(403, 'Forbidden', details);

    assert.strictEqual(error.details, details);
    assert.strictEqual((error.details as CustomDetails).userId, 123);
    assert.strictEqual((error.details as CustomDetails).action, 'delete');
  });

  test('can be caught as Error', () => {
    try {
      throw new HttpError(404, 'Not found');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error instanceof HttpError);
      assert.strictEqual((error as HttpError).statusCode, 404);
    }
  });

  test('toString returns message', () => {
    const error = new HttpError(500, 'Server error');
    const str = error.toString();

    assert.ok(str.includes('Server error'));
  });
});
