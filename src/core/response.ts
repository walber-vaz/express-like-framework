import type { ServerResponse } from 'node:http';
import { stringify } from '../utils/json.js';
import type {
  Headers,
  HttpStatusCode,
  ResponseContext,
} from '../utils/types.js';
import { HttpStatus } from '../utils/types.js';

/**
 * Response wrapper que encapsula ServerResponse e fornece API type-safe
 */
export class Response implements ResponseContext {
  public statusCode: number = HttpStatus.OK;
  public headers: Headers = {};
  public body?: unknown;
  public raw: ServerResponse;

  private _headersSent = false;
  private _finished = false;

  constructor(res: ServerResponse) {
    this.raw = res;
  }

  /**
   * Set status code
   */
  public status(code: HttpStatusCode): this {
    if (this._headersSent) {
      console.warn('Headers already sent, cannot set status');
      return this;
    }

    this.statusCode = code;
    return this;
  }

  /**
   * Set header
   */
  public header(name: string, value: string | string[]): this {
    if (this._headersSent) {
      console.warn('Headers already sent, cannot set header');
      return this;
    }

    this.headers[name.toLowerCase()] = value;
    return this;
  }

  /**
   * Set multiple headers at once
   */
  public setHeaders(headersObj: Record<string, string | string[]>): this {
    for (const [name, value] of Object.entries(headersObj)) {
      this.header(name, value);
    }
    return this;
  }

  /**
   * Get header value
   */
  public getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  /**
   * Remove header
   */
  public removeHeader(name: string): this {
    delete this.headers[name.toLowerCase()];
    return this;
  }

  /**
   * Set Content-Type header
   */
  public type(contentType: string): this {
    return this.header('content-type', contentType);
  }

  /**
   * Send JSON response
   */
  public json<T = unknown>(data: T): void {
    if (this._finished) {
      console.warn('Response already finished');
      return;
    }

    this.type('application/json; charset=utf-8');
    this.body = data;

    // Use the secure stringify function
    const json = stringify(data, {
      escapeHtml: true,
    });
    this._send(json);
  }

  /**
   * Send text response
   */
  public text(data: string): void {
    if (this._finished) {
      console.warn('Response already finished');
      return;
    }

    this.type('text/plain; charset=utf-8');
    this.body = data;
    this._send(data);
  }

  /**
   * Send HTML response
   */
  public html(data: string): void {
    if (this._finished) {
      console.warn('Response already finished');
      return;
    }

    this.type('text/html; charset=utf-8');
    this.body = data;
    this._send(data);
  }

  /**
   * Send response with any data (auto-detect type)
   */
  public send(data?: unknown): void {
    if (this._finished) {
      console.warn('Response already finished');
      return;
    }

    if (data === undefined || data === null) {
      this.status(HttpStatus.NO_CONTENT);
      this._send('');
      return;
    }

    if (typeof data === 'string') {
      if (!this.getHeader('content-type')) {
        this.type('text/html; charset=utf-8');
      }
      this.body = data;
      this._send(data);
      return;
    }

    if (Buffer.isBuffer(data)) {
      if (!this.getHeader('content-type')) {
        this.type('application/octet-stream');
      }
      this.body = data;
      this._send(data);
      return;
    }

    // Default to JSON for objects/arrays
    this.json(data);
  }

  /**
   * Redirect to URL
   */
  public redirect(
    url: string,
    statusCode: HttpStatusCode = HttpStatus.FOUND,
  ): void {
    if (this._finished) {
      console.warn('Response already finished');
      return;
    }

    this.status(statusCode);
    this.header('location', url);

    const body = `Redirecting to ${url}`;
    this.type('text/html; charset=utf-8');
    this._send(body);
  }

  /**
   * Set cookie
   */
  public cookie(
    name: string,
    value: string,
    options: CookieOptions = {},
  ): this {
    const cookie = this._serializeCookie(name, value, options);
    const existing = this.getHeader('set-cookie');

    if (existing) {
      const cookies = Array.isArray(existing) ? existing : [existing];
      this.header('set-cookie', [...cookies, cookie]);
    } else {
      this.header('set-cookie', cookie);
    }

    return this;
  }

  /**
   * Clear cookie
   */
  public clearCookie(name: string, options: CookieOptions = {}): this {
    return this.cookie(name, '', {
      ...options,
      expires: new Date(0),
      maxAge: 0,
    });
  }

  /**
   * Serialize cookie
   */
  private _serializeCookie(
    name: string,
    value: string,
    options: CookieOptions,
  ): string {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.domain) {
      cookie += `; Domain=${options.domain}`;
    }

    if (options.path) {
      cookie += `; Path=${options.path}`;
    } else {
      cookie += '; Path=/';
    }

    if (options.expires) {
      cookie += `; Expires=${options.expires.toUTCString()}`;
    }

    if (options.maxAge) {
      cookie += `; Max-Age=${options.maxAge}`;
    }

    if (options.httpOnly) {
      cookie += '; HttpOnly';
    }

    if (options.secure) {
      cookie += '; Secure';
    }

    if (options.sameSite) {
      cookie += `; SameSite=${options.sameSite}`;
    }

    return cookie;
  }

  /**
   * Send final response
   */
  private _send(data: string | Buffer): void {
    if (this._finished) return;

    this._writeHeaders();

    this.raw.end(data);
    this._finished = true;
  }

  /**
   * Write headers to response
   */
  private _writeHeaders(): void {
    if (this._headersSent) return;

    this.raw.statusCode = this.statusCode;

    for (const [name, value] of Object.entries(this.headers)) {
      if (value !== undefined) {
        this.raw.setHeader(name, value);
      }
    }

    this._headersSent = true;
  }

  /**
   * Check if headers were sent
   */
  public get headersSent(): boolean {
    return this._headersSent || this.raw.headersSent;
  }

  /**
   * Check if response is finished
   */
  public get finished(): boolean {
    return this._finished || this.raw.writableEnded;
  }

  /**
   * Stream support - write chunk without ending response
   */
  public write(chunk: string | Buffer): boolean {
    if (this._finished) {
      console.warn('Response already finished');
      return false;
    }

    if (!this._headersSent) {
      this._writeHeaders();
    }

    return this.raw.write(chunk);
  }

  /**
   * End response
   */
  public end(data?: string | Buffer): void {
    if (this._finished) {
      console.warn('Response already finished');
      return;
    }

    if (!this._headersSent) {
      this._writeHeaders();
    }

    this.raw.end(data);
    this._finished = true;
  }
}

/**
 * Cookie options
 */
export interface CookieOptions {
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}
