import assert from 'node:assert';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { describe, test } from 'node:test';
import { Request } from '../../src/core/request.js';
import { parseMultipart } from '../../src/utils/multipart.js';

/**
 * Helper para criar um mock de IncomingMessage
 */
function createMockIncomingMessage(
  headers: Record<string, string>,
): IncomingMessage {
  const stream = new Readable({
    read() {},
  }) as unknown as IncomingMessage;

  stream.headers = headers;
  return stream;
}

/**
 * Helper para criar multipart body manualmente
 */
function createMultipartBody(
  boundary: string,
  parts: Array<{
    name: string;
    filename?: string;
    contentType?: string;
    data: string | Buffer;
  }>,
): Buffer {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    // Boundary
    chunks.push(Buffer.from(`--${boundary}\r\n`));

    // Headers
    if (part.filename) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`,
        ),
      );
      chunks.push(
        Buffer.from(
          `Content-Type: ${part.contentType || 'application/octet-stream'}\r\n\r\n`,
        ),
      );
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"\r\n\r\n`,
        ),
      );
    }

    // Data
    chunks.push(
      typeof part.data === 'string' ? Buffer.from(part.data) : part.data,
    );
    chunks.push(Buffer.from('\r\n'));
  }

  // Final boundary
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return Buffer.concat(chunks);
}

describe('Multipart/Form-Data', () => {
  describe('parseMultipart', () => {
    test('should parse simple text fields', async () => {
      const boundary = 'boundary123';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      const body = createMultipartBody(boundary, [
        { name: 'name', data: 'John Doe' },
        { name: 'email', data: 'john@example.com' },
      ]);

      // Simulate request stream
      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      const result = await parseMultipart(req);

      assert.strictEqual(result.fields.name, 'John Doe');
      assert.strictEqual(result.fields.email, 'john@example.com');
      assert.strictEqual(result.files.length, 0);
    });

    test('should parse file upload', async () => {
      const boundary = 'boundary456';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      const fileContent = Buffer.from('Hello World');
      const body = createMultipartBody(boundary, [
        { name: 'title', data: 'Test Upload' },
        {
          name: 'file',
          filename: 'test.txt',
          contentType: 'text/plain',
          data: fileContent,
        },
      ]);

      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      const result = await parseMultipart(req);

      assert.strictEqual(result.fields.title, 'Test Upload');
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0].filename, 'test.txt');
      assert.strictEqual(result.files[0].mimetype, 'text/plain');
      assert.strictEqual(result.files[0].fieldname, 'file');
      assert.strictEqual(result.files[0].size, fileContent.length);
      assert.deepStrictEqual(result.files[0].data, fileContent);
    });

    test('should parse multiple files', async () => {
      const boundary = 'boundary789';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      const file1 = Buffer.from('File 1 content');
      const file2 = Buffer.from('File 2 content');

      const body = createMultipartBody(boundary, [
        {
          name: 'file1',
          filename: 'file1.txt',
          contentType: 'text/plain',
          data: file1,
        },
        {
          name: 'file2',
          filename: 'file2.txt',
          contentType: 'text/plain',
          data: file2,
        },
      ]);

      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      const result = await parseMultipart(req);

      assert.strictEqual(result.files.length, 2);
      assert.strictEqual(result.files[0].filename, 'file1.txt');
      assert.strictEqual(result.files[1].filename, 'file2.txt');
      assert.deepStrictEqual(result.files[0].data, file1);
      assert.deepStrictEqual(result.files[1].data, file2);
    });

    test('should handle multiple values for same field name', async () => {
      const boundary = 'boundary-multi';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      const body = createMultipartBody(boundary, [
        { name: 'tags', data: 'tag1' },
        { name: 'tags', data: 'tag2' },
        { name: 'tags', data: 'tag3' },
      ]);

      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      const result = await parseMultipart(req);

      assert.ok(Array.isArray(result.fields.tags));
      assert.deepStrictEqual(result.fields.tags, ['tag1', 'tag2', 'tag3']);
    });

    test('should respect file size limit', async () => {
      const boundary = 'boundary-limit';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      // Create 2MB file (exceeds 1MB limit we'll set)
      const largeFile = Buffer.alloc(2 * 1024 * 1024, 'a');

      const body = createMultipartBody(boundary, [
        {
          name: 'file',
          filename: 'large.txt',
          contentType: 'text/plain',
          data: largeFile,
        },
      ]);

      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      // Busboy trunca o arquivo mas não rejeita por padrão
      // Apenas verifica que o limite é respeitado
      const result = await parseMultipart(req, {
        limits: {
          fileSize: 1024 * 1024, // 1MB limit
        },
      });

      // O arquivo foi truncado no limite
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0].size <= 1024 * 1024);
    });

    test('should handle mixed fields and files', async () => {
      const boundary = 'boundary-mixed';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      const fileContent = Buffer.from('Document content');

      const body = createMultipartBody(boundary, [
        { name: 'title', data: 'My Document' },
        { name: 'author', data: 'John Doe' },
        {
          name: 'document',
          filename: 'doc.pdf',
          contentType: 'application/pdf',
          data: fileContent,
        },
        { name: 'category', data: 'reports' },
      ]);

      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      const result = await parseMultipart(req);

      assert.strictEqual(result.fields.title, 'My Document');
      assert.strictEqual(result.fields.author, 'John Doe');
      assert.strictEqual(result.fields.category, 'reports');
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0].filename, 'doc.pdf');
      assert.strictEqual(result.files[0].mimetype, 'application/pdf');
    });

    test('should handle empty file', async () => {
      const boundary = 'boundary-empty';
      const req = createMockIncomingMessage({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });

      const body = createMultipartBody(boundary, [
        {
          name: 'file',
          filename: 'empty.txt',
          contentType: 'text/plain',
          data: Buffer.from(''),
        },
      ]);

      setImmediate(() => {
        req.push(body);
        req.push(null);
      });

      const result = await parseMultipart(req);

      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0].size, 0);
      assert.strictEqual(result.files[0].data.length, 0);
    });
  });

  describe('Request.parseMultipart', () => {
    test('should throw error if content-type is not multipart/form-data', async () => {
      const stream = new Readable({
        read() {},
      }) as unknown as IncomingMessage;

      stream.method = 'POST';
      stream.url = '/upload';
      stream.headers = {
        'content-type': 'application/json',
      };

      const req = new Request(stream);

      await assert.rejects(
        async () => {
          await req.parseMultipart();
        },
        {
          message: 'Content-Type must be multipart/form-data',
        },
      );
    });

    test('should parse multipart via Request method', async () => {
      const boundary = 'request-boundary';
      const stream = new Readable({
        read() {},
      }) as unknown as IncomingMessage;

      stream.method = 'POST';
      stream.url = '/upload';
      stream.headers = {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      };

      const req = new Request(stream);

      const body = createMultipartBody(boundary, [
        { name: 'username', data: 'testuser' },
        {
          name: 'avatar',
          filename: 'avatar.png',
          contentType: 'image/png',
          data: Buffer.from('fake-png-data'),
        },
      ]);

      setImmediate(() => {
        stream.push(body);
        stream.push(null);
      });

      const result = await req.parseMultipart();

      assert.strictEqual(result.fields.username, 'testuser');
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0].filename, 'avatar.png');
      assert.strictEqual(result.files[0].mimetype, 'image/png');
    });

    test('should accept custom limits', async () => {
      const boundary = 'limits-boundary';
      const stream = new Readable({
        read() {},
      }) as unknown as IncomingMessage;

      stream.method = 'POST';
      stream.url = '/upload';
      stream.headers = {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      };

      const req = new Request(stream);

      const smallFile = Buffer.from('small file');
      const body = createMultipartBody(boundary, [
        {
          name: 'file',
          filename: 'small.txt',
          contentType: 'text/plain',
          data: smallFile,
        },
      ]);

      setImmediate(() => {
        stream.push(body);
        stream.push(null);
      });

      const result = await req.parseMultipart({
        limits: {
          fileSize: 1024, // 1KB
          files: 1,
        },
      });

      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0].size <= 1024);
    });
  });
});
