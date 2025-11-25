import type { IncomingMessage } from 'node:http';
import type {
  Headers,
  HttpMethod,
  QueryParams,
  RequestContext,
  RouteParams,
} from '../utils/types.js';
import { HttpError, HttpStatus } from '../utils/types.js';

/**
 * Request wrapper que encapsula IncomingMessage e fornece API type-safe
 */
export class Request implements RequestContext {
  public method: HttpMethod;
  public url: string;
  public path: string;
  public params: RouteParams = {};
  public query: QueryParams = {};
  public headers: Headers = {};
  public body?: unknown;
  public raw: IncomingMessage;

  private _parsedUrl: URL | null = null;
  private _maxBodySize: number;

  constructor(req: IncomingMessage, maxBodySize = 10 * 1024 * 1024) {
    this.raw = req;
    this.method = (req.method?.toUpperCase() || 'GET') as HttpMethod;
    this.url = req.url || '/';
    this._maxBodySize = maxBodySize;

    // Parse URL e query params
    this._parseUrl();
    this.path = this._parsedUrl?.pathname || '/';
    this._parseQuery();

    // Parse headers
    this._parseHeaders();
  }

  /**
   * Parse URL usando URL API nativa
   */
  private _parseUrl(): void {
    try {
      const host = this.raw.headers.host || 'localhost';
      const protocol = (this.raw.socket as any).encrypted ? 'https' : 'http';
      this._parsedUrl = new URL(this.url, `${protocol}://${host}`);
    } catch (error) {
      console.error('Error parsing URL:', error);
      this._parsedUrl = null;
    }
  }

  /**
   * Parse query parameters
   */
  private _parseQuery(): void {
    if (!this._parsedUrl) return;

    const query: QueryParams = {};
    this._parsedUrl.searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing) {
        query[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
      } else {
        query[key] = value;
      }
    });

    this.query = query;
  }

  /**
   * Parse headers
   */
  private _parseHeaders(): void {
    const headers: Headers = {};
    for (const [key, value] of Object.entries(this.raw.headers)) {
      if (value !== undefined) {
        headers[key.toLowerCase()] = value;
      }
    }
    this.headers = headers;
  }

  /**
   * Parse body JSON com proteção contra payloads grandes
   */
  public async parseBody(): Promise<unknown> {
    if (this.body !== undefined) {
      return this.body;
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      this.raw.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        totalSize += chunk.length;

        // Proteção contra payloads muito grandes (DoS protection)
        if (totalSize > this._maxBodySize) {
          this.raw.destroy();
          reject(
            new HttpError(
              HttpStatus.REQUEST_TOO_LARGE,
              `Payload too large. Maximum size is ${this._maxBodySize} bytes`,
            ),
          );
          return;
        }
      });

      this.raw.on('end', () => {
        try {
          // Usar Buffer.concat ao invés de string concatenation (O(n) ao invés de O(n²))
          const buffer = Buffer.concat(chunks);
          const data = buffer.toString('utf-8');

          const contentType = this.get('content-type');

          if (contentType?.includes('application/json')) {
            this.body = data ? JSON.parse(data) : undefined;
          } else if (
            contentType?.includes('application/x-www-form-urlencoded')
          ) {
            // Parse form data
            this.body = this._parseFormData(data);
          } else {
            // Raw text
            this.body = data || undefined;
          }

          resolve(this.body);
        } catch (error) {
          const message =
            error instanceof SyntaxError
              ? 'Invalid JSON in request body'
              : 'Failed to parse request body';
          reject(
            new HttpError(
              HttpStatus.BAD_REQUEST,
              message,
              error instanceof Error ? error.message : undefined,
            ),
          );
        }
      });

      this.raw.on('error', reject);
    });
  }

  /**
   * Parse form data (application/x-www-form-urlencoded)
   */
  private _parseFormData(data: string): Record<string, string> {
    const result: Record<string, string> = {};
    const params = new URLSearchParams(data);

    params.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Get header value (case-insensitive)
   */
  public get(headerName: string): string | string[] | undefined {
    return this.headers[headerName.toLowerCase()];
  }

  /**
   * Check if request has specific header
   */
  public has(headerName: string): boolean {
    return this.headers[headerName.toLowerCase()] !== undefined;
  }

  /**
   * Check if request accepts specific content type
   */
  public accepts(type: string): boolean {
    const accept = this.get('accept');
    if (!accept) return false;

    const acceptString = Array.isArray(accept) ? accept.join(',') : accept;
    return acceptString.includes(type) || acceptString.includes('*/*');
  }

  /**
   * Check if request is JSON
   */
  public isJson(): boolean {
    const contentType = this.get('content-type');
    if (!contentType) return false;

    const contentTypeString = Array.isArray(contentType)
      ? contentType[0]
      : contentType;
    return contentTypeString.includes('application/json');
  }

  /**
   * Get client IP address (considerando proxy headers)
   */
  public ip(trustProxy = false): string {
    if (trustProxy) {
      const forwarded = this.get('x-forwarded-for');
      if (forwarded) {
        const forwardedString = Array.isArray(forwarded)
          ? forwarded[0]
          : forwarded;
        return forwardedString.split(',')[0].trim();
      }

      const realIp = this.get('x-real-ip');
      if (realIp) {
        return Array.isArray(realIp) ? realIp[0] : realIp;
      }
    }

    return this.raw.socket.remoteAddress || 'unknown';
  }

  /**
   * Get hostname
   */
  public hostname(): string {
    const host = this.get('host');
    if (!host) return 'localhost';

    const hostString = Array.isArray(host) ? host[0] : host;
    return hostString.split(':')[0];
  }

  /**
   * Get protocol (http ou https)
   */
  public protocol(trustProxy = false): string {
    if (trustProxy) {
      const proto = this.get('x-forwarded-proto');
      if (proto) {
        return Array.isArray(proto) ? proto[0] : proto;
      }
    }

    return (this.raw.socket as any).encrypted ? 'https' : 'http';
  }

  /**
   * Check if request is secure (HTTPS)
   */
  public secure(trustProxy = false): boolean {
    return this.protocol(trustProxy) === 'https';
  }

  /**
   * Get full URL
   */
  public fullUrl(trustProxy = false): string {
    return `${this.protocol(trustProxy)}://${this.hostname()}${this.url}`;
  }
}
