import { type ZodError, type ZodSchema, z } from 'zod';
import type { Middleware, ValidationSchema } from '../utils/types.js';
import { HttpError, HttpStatus } from '../utils/types.js';

/**
 * Cria um middleware de validação a partir de schemas Zod
 * NOTA: Quando você usa { schema } nas rotas, a validação é automática!
 * Este middleware é opcional para casos especiais.
 */
export function validate(schema: ValidationSchema): Middleware {
  return async (req, res, next) => {
    try {
      // Valida body
      if (schema.body) {
        const result = schema.body.safeParse(req.body);
        if (!result.success) {
          const formatted = formatValidationErrorForHttp(result.error);
          throw new HttpError(
            HttpStatus.BAD_REQUEST,
            formatted.message,
            formatted.errors,
          );
        }
        req.body = result.data;
      }

      // Valida params
      if (schema.params) {
        const result = schema.params.safeParse(req.params);
        if (!result.success) {
          const formatted = formatValidationErrorForHttp(result.error);
          throw new HttpError(
            HttpStatus.BAD_REQUEST,
            formatted.message,
            formatted.errors,
          );
        }
        req.params = result.data;
      }

      // Valida query
      if (schema.query) {
        const result = schema.query.safeParse(req.query);
        if (!result.success) {
          const formatted = formatValidationErrorForHttp(result.error);
          throw new HttpError(
            HttpStatus.BAD_REQUEST,
            formatted.message,
            formatted.errors,
          );
        }
        req.query = result.data;
      }

      // Valida headers
      if (schema.headers) {
        const result = schema.headers.safeParse(req.headers);
        if (!result.success) {
          const formatted = formatValidationErrorForHttp(result.error);
          throw new HttpError(
            HttpStatus.BAD_REQUEST,
            formatted.message,
            formatted.errors,
          );
        }
        req.headers = result.data;
      }

      next();
    } catch (error) {
      next(error as Error);
    }
  };
}

/**
 * Formata erro do Zod para formato mais amigável
 */
export function formatZodError(error: ZodError): unknown {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Formata erro de validação para resposta HTTP-friendly
 * Usado pela Application para retornar erros consistentes
 */
export function formatValidationErrorForHttp(error: ZodError): {
  message: string;
  errors: Array<{ field: string; message: string; code: string }>;
} {
  return {
    message: 'Validation failed',
    errors: error.errors.map((err) => ({
      field: err.path.join('.') || 'root',
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Helper para criar schema de body
 */
export function body<T extends ZodSchema>(schema: T): ValidationSchema {
  return { body: schema };
}

/**
 * Helper para criar schema de params
 */
export function params<T extends ZodSchema>(schema: T): ValidationSchema {
  return { params: schema };
}

/**
 * Helper para criar schema de query
 */
export function query<T extends ZodSchema>(schema: T): ValidationSchema {
  return { query: schema };
}

/**
 * Helper para criar schema de headers
 */
export function headers<T extends ZodSchema>(schema: T): ValidationSchema {
  return { headers: schema };
}

/**
 * Combina múltiplos schemas
 */
export function combine(...schemas: ValidationSchema[]): ValidationSchema {
  return schemas.reduce(
    (acc, schema) => ({
      body: schema.body || acc.body,
      params: schema.params || acc.params,
      query: schema.query || acc.query,
      headers: schema.headers || acc.headers,
    }),
    {} as ValidationSchema,
  );
}

/**
 * Re-exporta tipos e funções úteis do Zod
 */
export { z, type ZodSchema, type ZodError };

/**
 * Schemas comuns reutilizáveis
 */
export const commonSchemas = {
  /**
   * ID como número
   */
  numericId: z.object({
    id: z.coerce.number().int().positive(),
  }),

  /**
   * ID como string UUID
   */
  uuidId: z.object({
    id: z.string().uuid(),
  }),

  /**
   * ID genérico (string)
   */
  stringId: z.object({
    id: z.string().min(1),
  }),

  /**
   * Paginação
   */
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),

  /**
   * Ordenação
   */
  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  /**
   * Email
   */
  email: z.object({
    email: z.string().email(),
  }),

  /**
   * Timestamps
   */
  timestamps: z.object({
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  }),
};
