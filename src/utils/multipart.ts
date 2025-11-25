import type { IncomingMessage } from 'node:http';
import busboy from 'busboy';

/**
 * Representa um arquivo enviado via multipart/form-data
 */
export interface UploadedFile {
  /** Nome do campo do formulário */
  fieldname: string;
  /** Nome original do arquivo */
  filename: string;
  /** Encoding do arquivo */
  encoding: string;
  /** MIME type do arquivo */
  mimetype: string;
  /** Tamanho do arquivo em bytes */
  size: number;
  /** Conteúdo do arquivo como Buffer */
  data: Buffer;
}

/**
 * Resultado do parsing de multipart/form-data
 */
export interface MultipartResult {
  /** Campos de texto do formulário */
  fields: Record<string, string | string[]>;
  /** Arquivos enviados */
  files: UploadedFile[];
}

/**
 * Opções para parsing de multipart
 */
export interface MultipartOptions {
  /** Limites de tamanho e quantidade */
  limits?: {
    /** Tamanho máximo por arquivo em bytes (padrão: 10MB) */
    fileSize?: number;
    /** Número máximo de arquivos (padrão: 10) */
    files?: number;
    /** Número máximo de campos (padrão: 100) */
    fields?: number;
    /** Tamanho máximo do nome do arquivo em bytes (padrão: 255) */
    fieldNameSize?: number;
    /** Tamanho máximo do valor do campo em bytes (padrão: 1MB) */
    fieldSize?: number;
  };
}

/**
 * Faz parsing de multipart/form-data request
 *
 * @example
 * ```typescript
 * app.post('/upload', async (req, res) => {
 *   const { fields, files } = await parseMultipart(req.raw, {
 *     limits: { fileSize: 5 * 1024 * 1024 } // 5MB
 *   });
 *
 *   res.json({
 *     message: 'Upload successful',
 *     filesUploaded: files.length
 *   });
 * });
 * ```
 */
export async function parseMultipart(
  req: IncomingMessage,
  options: MultipartOptions = {},
): Promise<MultipartResult> {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: options.limits ?? {
        fileSize: 10 * 1024 * 1024, // 10MB default
        files: 10,
        fields: 100,
        fieldNameSize: 255,
        fieldSize: 1024 * 1024, // 1MB
      },
    });

    const fields: Record<string, string | string[]> = {};
    const files: UploadedFile[] = [];

    // Handler para campos de texto
    bb.on('field', (name, value) => {
      if (fields[name]) {
        // Se já existe, converte para array
        if (Array.isArray(fields[name])) {
          (fields[name] as string[]).push(value);
        } else {
          fields[name] = [fields[name] as string, value];
        }
      } else {
        fields[name] = value;
      }
    });

    // Handler para arquivos
    bb.on('file', (fieldname, file, info) => {
      const chunks: Buffer[] = [];
      let size = 0;

      file.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      file.on('end', () => {
        files.push({
          fieldname,
          filename: info.filename,
          encoding: info.encoding,
          mimetype: info.mimeType,
          size,
          data: Buffer.concat(chunks),
        });
      });

      file.on('error', reject);
    });

    bb.on('finish', () => {
      resolve({ fields, files });
    });

    bb.on('error', reject);

    // Pipe da request para o busboy
    req.pipe(bb);
  });
}
