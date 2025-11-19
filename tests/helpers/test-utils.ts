/**
 * Test utilities and helpers
 */

import type { Application } from '../../dist/core/application.js';
import { createApp } from '../../dist/index.js';
import type { ApplicationOptions } from '../../dist/utils/types.js';

/**
 * Wait for async operations
 */
export async function waitForAsync(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a test application with default options
 */
export function createTestApp(options: ApplicationOptions = {}): Application {
  return createApp({
    port: 0, // Random port
    debug: false,
    ...options,
  });
}

/**
 * Capture console output during function execution
 */
export function captureConsole(
  fn: () => void | Promise<void>,
): string[] | Promise<string[]> {
  const logs: string[] = [];
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => logs.push(args.join(' '));
  console.info = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => logs.push(args.join(' '));
  console.error = (...args) => logs.push(args.join(' '));

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .finally(() => {
          console.log = originalLog;
          console.info = originalInfo;
          console.warn = originalWarn;
          console.error = originalError;
        })
        .then(() => logs);
    }
    return logs;
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

/**
 * Suppress console output during function execution
 */
export async function suppressConsole<T>(fn: () => T | Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

/**
 * Assert that a function throws an error
 */
export async function assertThrows(
  fn: () => void | Promise<void>,
  errorCheck?: (error: Error) => boolean,
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Expected function to throw, but it did not') {
        throw error;
      }

      if (errorCheck && !errorCheck(error)) {
        throw new Error(
          `Error did not match expected condition: ${error.message}`,
        );
      }

      return error;
    }
    throw error;
  }
}

/**
 * Assert that a function does not throw
 */
export async function assertDoesNotThrow(
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    throw new Error(`Expected function not to throw, but it threw: ${error}`);
  }
}

/**
 * Deep clone an object (for test data)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Create a spy function that tracks calls
 */
export interface SpyFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
  calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }>;
  callCount: number;
  wasCalled: boolean;
  wasCalledWith: (...args: Parameters<T>) => boolean;
  reset: () => void;
}

export function createSpy<T extends (...args: any[]) => any>(
  implementation?: T,
): SpyFunction<T> {
  const calls: Array<{
    args: Parameters<T>;
    result?: ReturnType<T>;
    error?: Error;
  }> = [];

  const spy = ((...args: Parameters<T>) => {
    try {
      const result = implementation ? implementation(...args) : undefined;
      calls.push({ args, result });
      return result;
    } catch (error) {
      calls.push({ args, error: error as Error });
      throw error;
    }
  }) as SpyFunction<T>;

  Object.defineProperty(spy, 'calls', {
    get: () => calls,
  });

  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });

  Object.defineProperty(spy, 'wasCalled', {
    get: () => calls.length > 0,
  });

  spy.wasCalledWith = (...args: Parameters<T>) => {
    return calls.some(
      (call) =>
        call.args.length === args.length &&
        call.args.every((arg, i) => arg === args[i]),
    );
  };

  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Create a mock that can be configured
 */
export function createMock<T extends Record<string, any>>(
  methods: Partial<T> = {},
): T & { _calls: Map<keyof T, any[][]>; _reset: () => void } {
  const calls = new Map<keyof T, any[][]>();

  const mock = new Proxy(
    {} as T & { _calls: Map<keyof T, any[][]>; _reset: () => void },
    {
      get(target, prop) {
        if (prop === '_calls') {
          return calls;
        }

        if (prop === '_reset') {
          return () => {
            calls.clear();
          };
        }

        if (prop in methods) {
          return (...args: any[]) => {
            if (!calls.has(prop as keyof T)) {
              calls.set(prop as keyof T, []);
            }
            calls.get(prop as keyof T)!.push(args);

            const method = methods[prop as keyof T];
            if (typeof method === 'function') {
              return method(...args);
            }
            return method;
          };
        }

        return () => {};
      },
    },
  );

  return mock;
}

/**
 * Sleep for testing async behavior
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, delay = 100 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
