/**
 * Mock HTTP helpers for testing
 * Provides mock IncomingMessage and ServerResponse for unit tests
 */

import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

/**
 * Options for creating a mock request
 */
export interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[]>;
  body?: string | Buffer;
  socket?: Partial<Socket>;
}

/**
 * Options for creating a mock response
 */
export interface MockResponseOptions {
  statusCode?: number;
  headers?: Record<string, string | string[]>;
}

/**
 * Extended mock response with test helpers
 */
export interface MockResponse extends ServerResponse {
  _body: string;
  _headers: Record<string, string | string[]>;
  _statusCode: number;
  _finished: boolean;
  _chunks: (string | Buffer)[];

  // Helper methods for testing
  getBody(): string;
  getHeaders(): Record<string, string | string[]>;
  getStatusCode(): number;
  isFinished(): boolean;
  getChunks(): (string | Buffer)[];
}

/**
 * Creates a mock IncomingMessage for testing
 */
export function createMockRequest(
  options: MockRequestOptions = {},
): IncomingMessage {
  const {
    method = 'GET',
    url = '/',
    headers = {},
    body = '',
    socket = {},
  } = options;

  const req = new EventEmitter() as IncomingMessage;

  // Basic properties
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.httpVersion = '1.1';
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;

  // Socket
  req.socket = {
    remoteAddress: '127.0.0.1',
    remotePort: 12345,
    localAddress: '127.0.0.1',
    localPort: 3000,
    encrypted: false,
    ...socket,
  } as Socket;

  // Connection (alias for socket)
  req.connection = req.socket;

  // Readable stream interface
  const bodyBuffer = Buffer.from(body);
  let bodyRead = false;

  req.readable = true;
  req.readableEnded = false;
  req.readableHighWaterMark = 16384;
  req.readableLength = bodyBuffer.length;

  // Read method
  (req as any).read = (size?: number) => {
    if (bodyRead) return null;
    bodyRead = true;
    req.readableEnded = true;
    return bodyBuffer;
  };

  // Push data immediately (simulate stream)
  process.nextTick(() => {
    if (bodyBuffer.length > 0) {
      req.emit('data', bodyBuffer);
    }
    req.emit('end');
  });

  // Complete flag
  req.complete = false;
  req.on('end', () => {
    req.complete = true;
  });

  return req;
}

/**
 * Creates a mock ServerResponse for testing
 */
export function createMockResponse(
  options: MockResponseOptions = {},
): MockResponse {
  const { statusCode = 200, headers = {} } = options;

  const res = new EventEmitter() as MockResponse;

  // Internal state
  res._body = '';
  res._headers = { ...headers };
  res._statusCode = statusCode;
  res._finished = false;
  res._chunks = [];

  // Properties - use getter/setter to sync statusCode with _statusCode
  Object.defineProperty(res, 'statusCode', {
    get() {
      return res._statusCode;
    },
    set(value: number) {
      res._statusCode = value;
    },
    enumerable: true,
    configurable: true,
  });

  res.statusMessage = '';
  res.headersSent = false;
  res.writableEnded = false;
  res.writableFinished = false;

  // Socket
  res.socket = {
    writable: true,
    destroyed: false,
  } as Socket;

  // Connection (alias for socket)
  res.connection = res.socket;

  // setHeader
  res.setHeader = (name: string, value: string | string[]): ServerResponse => {
    res._headers[name.toLowerCase()] = value;
    return res;
  };

  // getHeader
  res.getHeader = (name: string): string | string[] | undefined =>
    res._headers[name.toLowerCase()];

  // getHeaders
  res.getHeaders = (): Record<string, string | string[]> => ({
    ...res._headers,
  });

  // hasHeader
  res.hasHeader = (name: string): boolean => name.toLowerCase() in res._headers;

  // removeHeader
  res.removeHeader = (name: string): void => {
    delete res._headers[name.toLowerCase()];
  };

  // getHeaderNames
  res.getHeaderNames = (): string[] => Object.keys(res._headers);

  // writeHead
  res.writeHead = (
    statusCode: number,
    statusMessage?: string | Record<string, string | string[]>,
    headers?: Record<string, string | string[]>,
  ): ServerResponse => {
    res._statusCode = statusCode;
    res.statusCode = statusCode;

    if (typeof statusMessage === 'string') {
      res.statusMessage = statusMessage;
      if (headers) {
        Object.entries(headers).forEach(([name, value]) => {
          res.setHeader(name, value);
        });
      }
    } else if (typeof statusMessage === 'object') {
      Object.entries(statusMessage).forEach(([name, value]) => {
        res.setHeader(name, value);
      });
    }

    res.headersSent = true;
    return res;
  };

  // write
  res.write = (
    chunk: string | Buffer,
    encoding?: BufferEncoding | (() => void),
    callback?: () => void,
  ): boolean => {
    if (!res.headersSent) {
      res.headersSent = true;
    }

    const chunkBuffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8');

    res._chunks.push(chunkBuffer);
    res._body += chunkBuffer.toString('utf8');

    if (typeof encoding === 'function') {
      encoding();
    } else if (callback) {
      callback();
    }

    return true;
  };

  // end
  res.end = (
    data?: string | Buffer | (() => void),
    encoding?: BufferEncoding | (() => void),
    callback?: () => void,
  ): ServerResponse => {
    if (!res.headersSent) {
      res.headersSent = true;
    }

    if (data) {
      if (typeof data === 'function') {
        callback = data;
      } else {
        const dataBuffer = Buffer.isBuffer(data)
          ? data
          : Buffer.from(data, typeof encoding === 'string' ? encoding : 'utf8');

        res._chunks.push(dataBuffer);
        res._body += dataBuffer.toString('utf8');
      }
    }

    res._finished = true;
    res.writableEnded = true;
    res.writableFinished = true;

    if (typeof encoding === 'function') {
      encoding();
    } else if (callback) {
      callback();
    }

    res.emit('finish');
    return res;
  };

  // Helper methods for testing
  res.getBody = (): string => res._body;

  res.getHeaders = (): Record<string, string | string[]> => ({
    ...res._headers,
  });

  res.getStatusCode = (): number => res._statusCode;

  res.isFinished = (): boolean => res._finished;

  res.getChunks = (): (string | Buffer)[] => [...res._chunks];

  return res;
}

/**
 * Creates a mock request with JSON body
 */
export function createMockJsonRequest(
  body: unknown,
  options: Omit<MockRequestOptions, 'body'> = {},
): IncomingMessage {
  return createMockRequest({
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Creates a mock request with form-urlencoded body
 */
export function createMockFormRequest(
  data: Record<string, string>,
  options: Omit<MockRequestOptions, 'body'> = {},
): IncomingMessage {
  const body = new URLSearchParams(data).toString();

  return createMockRequest({
    ...options,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
    body,
  });
}
