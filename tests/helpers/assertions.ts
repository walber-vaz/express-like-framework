/**
 * Custom assertions for testing
 */

import assert from 'node:assert';
import type { ResponseContext } from '../../dist/utils/types.js';
import type { MockResponse } from './mock-http.js';

/**
 * Assert that response has expected status code
 */
export function assertStatusCode(
  res: ResponseContext | MockResponse,
  expected: number,
  message?: string,
): void {
  const actual = 'getStatusCode' in res ? res.getStatusCode() : res.statusCode;
  assert.strictEqual(
    actual,
    expected,
    message || `Expected status code ${expected}, got ${actual}`,
  );
}

/**
 * Assert that response has a specific header
 */
export function assertHeader(
  res: ResponseContext | MockResponse,
  name: string,
  expected: string | string[],
  message?: string,
): void {
  const headers = 'getHeaders' in res ? res.getHeaders() : res.headers;
  const actual = headers[name.toLowerCase()];

  assert.deepStrictEqual(
    actual,
    expected,
    message || `Expected header "${name}" to be "${expected}", got "${actual}"`,
  );
}

/**
 * Assert that response has a header (existence check)
 */
export function assertHasHeader(
  res: ResponseContext | MockResponse,
  name: string,
  message?: string,
): void {
  const headers = 'getHeaders' in res ? res.getHeaders() : res.headers;
  const hasHeader = name.toLowerCase() in headers;

  assert.ok(hasHeader, message || `Expected response to have header "${name}"`);
}

/**
 * Assert that response does not have a header
 */
export function assertNoHeader(
  res: ResponseContext | MockResponse,
  name: string,
  message?: string,
): void {
  const headers = 'getHeaders' in res ? res.getHeaders() : res.headers;
  const hasHeader = name.toLowerCase() in headers;

  assert.ok(
    !hasHeader,
    message || `Expected response not to have header "${name}"`,
  );
}

/**
 * Assert that response body contains expected string
 */
export function assertBodyContains(
  res: MockResponse,
  expected: string,
  message?: string,
): void {
  const body = res.getBody();
  assert.ok(
    body.includes(expected),
    message || `Expected body to contain "${expected}", got "${body}"`,
  );
}

/**
 * Assert that response body matches expected value
 */
export function assertBody(
  res: MockResponse,
  expected: string,
  message?: string,
): void {
  const body = res.getBody();
  assert.strictEqual(
    body,
    expected,
    message || `Expected body "${expected}", got "${body}"`,
  );
}

/**
 * Assert that response body is valid JSON
 */
export function assertJsonBody(
  res: MockResponse,
  expected?: unknown,
  message?: string,
): void {
  const body = res.getBody();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(`Expected valid JSON body, got: ${body}`);
  }

  if (expected !== undefined) {
    assert.deepStrictEqual(
      parsed,
      expected,
      message || `Expected JSON body to match`,
    );
  }
}

/**
 * Assert that response is finished
 */
export function assertFinished(res: MockResponse, message?: string): void {
  assert.ok(res.isFinished(), message || 'Expected response to be finished');
}

/**
 * Assert that response is not finished
 */
export function assertNotFinished(res: MockResponse, message?: string): void {
  assert.ok(
    !res.isFinished(),
    message || 'Expected response not to be finished',
  );
}

/**
 * Assert that object has property with value
 */
export function assertProperty<T extends Record<string, any>>(
  obj: T,
  key: keyof T,
  expected: T[keyof T],
  message?: string,
): void {
  assert.ok(
    key in obj,
    message || `Expected object to have property "${String(key)}"`,
  );

  assert.deepStrictEqual(
    obj[key],
    expected,
    message ||
      `Expected property "${String(key)}" to be "${expected}", got "${obj[key]}"`,
  );
}

/**
 * Assert that array contains item
 */
export function assertContains<T>(array: T[], item: T, message?: string): void {
  assert.ok(array.includes(item), message || `Expected array to contain item`);
}

/**
 * Assert that array does not contain item
 */
export function assertNotContains<T>(
  array: T[],
  item: T,
  message?: string,
): void {
  assert.ok(
    !array.includes(item),
    message || `Expected array not to contain item`,
  );
}

/**
 * Assert that function was called
 */
export function assertCalled(
  spy: { wasCalled: boolean },
  message?: string,
): void {
  assert.ok(spy.wasCalled, message || 'Expected function to be called');
}

/**
 * Assert that function was not called
 */
export function assertNotCalled(
  spy: { wasCalled: boolean },
  message?: string,
): void {
  assert.ok(!spy.wasCalled, message || 'Expected function not to be called');
}

/**
 * Assert that function was called N times
 */
export function assertCallCount(
  spy: { callCount: number },
  expected: number,
  message?: string,
): void {
  assert.strictEqual(
    spy.callCount,
    expected,
    message ||
      `Expected function to be called ${expected} times, got ${spy.callCount}`,
  );
}

/**
 * Assert that value matches pattern (regex)
 */
export function assertMatches(
  value: string,
  pattern: RegExp,
  message?: string,
): void {
  assert.ok(
    pattern.test(value),
    message || `Expected "${value}" to match pattern ${pattern}`,
  );
}

/**
 * Assert that value does not match pattern (regex)
 */
export function assertNotMatches(
  value: string,
  pattern: RegExp,
  message?: string,
): void {
  assert.ok(
    !pattern.test(value),
    message || `Expected "${value}" not to match pattern ${pattern}`,
  );
}

/**
 * Assert that value is within range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string,
): void {
  assert.ok(
    value >= min && value <= max,
    message || `Expected ${value} to be between ${min} and ${max}`,
  );
}

/**
 * Assert that value is truthy
 */
export function assertTruthy(value: unknown, message?: string): void {
  assert.ok(value, message || `Expected value to be truthy, got ${value}`);
}

/**
 * Assert that value is falsy
 */
export function assertFalsy(value: unknown, message?: string): void {
  assert.ok(!value, message || `Expected value to be falsy, got ${value}`);
}
