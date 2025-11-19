/**
 * LikeExpress - Modern Node.js Web Framework
 * TypeScript-first, ES Modules, with batteries included
 */

// Core exports
export { Application } from './core/application.js';

import { Application } from './core/application.js';
import type { ApplicationOptions } from './utils/types.js';

export {
  context,
  performanceMiddleware,
  requestIdMiddleware,
} from './core/context.js';
export {
  compose,
  conditional,
  createMiddleware,
  MiddlewareChain,
  onlyMethods,
  onlyPaths,
} from './core/middleware.js';
export { Request } from './core/request.js';
// Cookie options from Response
export type { CookieOptions } from './core/response.js';
export { Response } from './core/response.js';
export { RouteBuilder, Router } from './core/router.js';
// Plugin exports
export {
  createPlugin,
  type Plugin as PluginType,
  type PluginBuilderType,
  plugins,
} from './plugins/index.js';
// Security exports
export { type CorsOptions, cors, corsPresets } from './security/cors.js';
export {
  type HelmetOptions,
  helmet,
  helmetPresets,
} from './security/helmet.js';
export {
  type RateLimitOptions,
  rateLimit,
  rateLimitByRoute,
  rateLimitByUser,
  rateLimitPresets,
} from './security/rate-limit.js';
// Utilities exports
export {
  asyncHandler,
  createError,
  createErrorHandler,
  createHtmlErrorHandler,
  errorBoundary,
} from './utils/error-handler.js';
export { type StringifyOptions, stringify } from './utils/json.js';
export {
  createLogger,
  Logger,
  type LoggerOptions,
  LogLevel,
  logger,
  performanceLogger,
  requestLogger,
} from './utils/logger.js';
export {
  type ApplicationOptions,
  type ErrorHandler,
  type Handler,
  type Headers,
  HttpError,
  type HttpMethod,
  HttpStatus,
  type HttpStatusCode,
  type Middleware,
  type NextFunction,
  type Plugin,
  type QueryParams,
  type RequestContext,
  type ResponseContext,
  type Route,
  type RouteParams,
  type ValidationSchema,
} from './utils/types.js';
// Validation exports
export {
  body,
  combine,
  commonSchemas,
  formatZodError,
  headers,
  params,
  query,
  validate,
  type ZodError,
  type ZodSchema,
  z,
} from './validation/index.js';

/**
 * Factory function para criar aplicação
 */
export function createApp(options?: ApplicationOptions) {
  return new Application(options);
}

/**
 * Default export
 */
export { Application as default };
