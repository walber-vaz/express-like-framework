# 📚 API Reference Completa - LikeExpress

Documentação completa de todas as features, métodos e opções disponíveis no LikeExpress.

---

## Índice

- [Application](#application)
- [Router](#router)
- [Request](#request)
- [Response](#response)
- [Middleware](#middleware)
- [Context (AsyncLocalStorage)](#context)
- [Validation](#validation)
- [Security](#security)
  - [CORS](#cors)
  - [Helmet](#helmet)
  - [Rate Limiting](#rate-limiting)
- [Plugins](#plugins)
- [Error Handling](#error-handling)
- [Logger](#logger)
- [JSON Utilities](#json-utilities)
- [Types & Constants](#types--constants)

---

## Application

### Criação

```typescript
import { createApp } from 'like-express-node-typescript';

const app = createApp(options?);
```

### ApplicationOptions

```typescript
interface ApplicationOptions {
  port?: number;              // Default: 3000
  host?: string;              // Default: 'localhost'
  debug?: boolean;            // Default: false - Habilita logs detalhados
  trustProxy?: boolean;       // Default: false - Confia em headers X-Forwarded-*
  errorHandler?: ErrorHandler; // Handler customizado de erros
}
```

### Métodos de Lifecycle

#### `listen(port?, host?): Promise<Server>`

Inicia o servidor HTTP.

```typescript
await app.listen(3000, '0.0.0.0');
// ou
await app.listen(); // Usa port e host do constructor
```

#### `close(): Promise<void>`

Para o servidor gracefully.

```typescript
await app.close();
```

#### `isRunning(): boolean`

Verifica se o servidor está rodando.

```typescript
if (app.isRunning()) {
  console.log('Server is up!');
}
```

#### `getServer(): Server | null`

Retorna a instância do servidor HTTP nativo do Node.js.

```typescript
const server = app.getServer();
```

### Middleware e Plugins

#### `use(middleware: Middleware): Application`

Registra middleware global (aplicado a todas as rotas).

```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

Chainable:

```typescript
app
  .use(cors())
  .use(helmet())
  .use(rateLimit());
```

#### `plugin(plugin: Plugin): Promise<Application>`

Instala um plugin.

```typescript
await app.plugin(plugins.security());
await app.plugin(plugins.logging());
```

### Registro de Rotas

Todos os métodos HTTP suportam:

- Path pattern (`:param`, wildcards, regex)
- Handler function
- Options object (middleware, schema)

#### `get(path, handler, options?): Application`

#### `post(path, handler, options?): Application`

#### `put(path, handler, options?): Application`

#### `patch(path, handler, options?): Application`

#### `delete(path, handler, options?): Application`

#### `head(path, handler, options?): Application`

#### `options(path, handler, options?): Application`

```typescript
// Rota simples
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// Com parâmetros
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

// Com middleware específico
app.post('/users', {
  middleware: [validate(userSchema)],
}, (req, res) => {
  res.status(201).json(req.body);
});

// Com validação
app.post('/users', {
  schema: {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  }
}, (req, res) => {
  // req.body é tipado automaticamente!
  res.json(req.body);
});
```

### RouteOptions

```typescript
interface RouteOptions {
  middleware?: Middleware[];    // Middleware específico da rota
  schema?: ValidationSchema;    // Schema Zod para validação
}
```

### Outros Métodos

#### `getRouter(): Router`

Acessa o router interno diretamente.

```typescript
const router = app.getRouter();
console.log(router.size); // Número de rotas
```

#### `getOptions(): Required<ApplicationOptions>`

Retorna as opções de configuração.

```typescript
const options = app.getOptions();
console.log(options.port, options.debug);
```

---

## Router

### Criação

```typescript
import { Router } from 'like-express-node-typescript';

const router = new Router();
```

### Registro de Rotas

Mesmos métodos que Application:

```typescript
router.get('/users', handler);
router.post('/users', handler, { middleware: [...] });
router.put('/users/:id', handler);
router.delete('/users/:id', handler);
```

### Pattern Matching

Powered by **find-my-way** (Fastify router) - Alta performance com Radix Tree.

**Suporte a Patterns:**

```typescript
// Parâmetros nomeados
router.get('/users/:id', ...);           // Match: /users/123

// Parâmetros opcionais
router.get('/users/:id?', ...);          // Match: /users OU /users/123

// Wildcards
router.get('/files/*', ...);             // Match: /files/any/path

// Multi-segmento
router.get('/users/:userId/posts/:postId', ...);

// Regex (com allowUnsafeRegex: true)
router.get('/files/:name(.*\\.pdf)', ...);
```

**Configurações do Router:**

- Case-insensitive: `/Users` === `/users`
- Trailing slash ignored: `/api` === `/api/`
- Suporta regex complexas

### Métodos de Matching

#### `match(method, path): RouteMatchResult`

Encontra rota correspondente.

```typescript
const result = router.match('GET', '/users/123');

if (result.status === 'MATCH') {
  console.log(result.route.handler);
  console.log(result.params); // { id: '123' }
} else if (result.status === 'METHOD_NOT_ALLOWED') {
  console.log(result.allowedMethods); // ['POST', 'PUT']
} else {
  // NOT_FOUND
}
```

#### `getAllowedMethods(path): HttpMethod[]`

Retorna todos os métodos HTTP disponíveis para um path.

```typescript
const methods = router.getAllowedMethods('/users');
// ['GET', 'POST', 'PUT', 'DELETE']
```

### Utilities

#### `clear(): void`

Remove todas as rotas.

```typescript
router.clear();
```

#### `size: number`

Propriedade que retorna o número de rotas registradas.

```typescript
console.log(router.size);
```

### RouteBuilder (API Fluente)

```typescript
import { RouteBuilder } from 'like-express-node-typescript';

new RouteBuilder('/users')
  .post()
  .middleware(validate(schema))
  .handler((req, res) => res.json({}))
  .register(router);
```

---

## Request

### Propriedades

```typescript
interface RequestContext {
  method: HttpMethod;           // 'GET', 'POST', etc.
  url: string;                  // URL completa
  path: string;                 // Pathname sem query
  params: RouteParams;          // Parâmetros de rota { id: '123' }
  query: QueryParams;           // Query string { page: '1', limit: '10' }
  headers: Headers;             // Headers HTTP (lowercase keys)
  body?: unknown;               // Body parseado
  raw: IncomingMessage;         // Request nativo do Node.js
}
```

### Body Parsing

#### `parseBody(): Promise<void>`

Parseia o body da request (chamado automaticamente).

**Suporta:**

- `application/json` → Objeto JavaScript
- `application/x-www-form-urlencoded` → Objeto de formulário
- `text/*` → String

```typescript
await req.parseBody();
console.log(req.body);
```

### Header Methods

#### `get(headerName: string): string | string[] | undefined`

Obtém valor de um header (case-insensitive).

```typescript
const auth = req.get('authorization');
const contentType = req.get('Content-Type');
```

#### `has(headerName: string): boolean`

Verifica se header existe.

```typescript
if (req.has('authorization')) {
  // ...
}
```

#### `accepts(type: string): boolean`

Verifica se cliente aceita determinado content-type.

```typescript
if (req.accepts('application/json')) {
  res.json({ data });
} else {
  res.text('data');
}
```

#### `isJson(): boolean`

Verifica se Content-Type é JSON.

```typescript
if (req.isJson()) {
  // Body já foi parseado como JSON
}
```

### Request Info

#### `ip(trustProxy?: boolean): string`

Obtém IP do cliente.

```typescript
const ip = req.ip();              // Direto
const ip = req.ip(true);          // Considera X-Forwarded-For
```

#### `hostname(): string`

Obtém hostname do header Host.

```typescript
const host = req.hostname(); // 'example.com'
```

#### `protocol(trustProxy?: boolean): 'http' | 'https'`

Obtém protocolo.

```typescript
const protocol = req.protocol();     // Socket direto
const protocol = req.protocol(true); // Considera X-Forwarded-Proto
```

#### `secure(trustProxy?: boolean): boolean`

Verifica se é HTTPS.

```typescript
if (req.secure()) {
  // Conexão segura
}
```

#### `fullUrl(trustProxy?: boolean): string`

URL completa incluindo protocolo e host.

```typescript
const url = req.fullUrl();
// 'https://example.com/users?page=1'
```

---

## Response

### Propriedades

```typescript
interface ResponseContext {
  statusCode: number;
  headers: Headers;
  body?: unknown;
  raw: ServerResponse;
  finished: boolean;           // Response completada?
  headersSent: boolean;        // Headers enviados?
}
```

### Status Code

#### `status(code: HttpStatusCode): Response`

Define status HTTP (chainable).

```typescript
res.status(201).json({ created: true });
res.status(404).json({ error: 'Not Found' });
```

### Headers

#### `header(name: string, value: string | string[]): Response`

Define um header (chainable).

```typescript
res
  .header('X-Custom', 'value')
  .header('X-Another', 'value2')
  .json({});
```

#### `setHeaders(headers: Record<string, string | string[]>): Response`

Define múltiplos headers (chainable).

```typescript
res.setHeaders({
  'X-Custom-1': 'value1',
  'X-Custom-2': 'value2',
}).json({});
```

#### `getHeader(name: string): string | string[] | undefined`

Obtém valor de um header.

```typescript
const contentType = res.getHeader('content-type');
```

#### `removeHeader(name: string): Response`

Remove um header (chainable).

```typescript
res.removeHeader('X-Powered-By').json({});
```

#### `type(contentType: string): Response`

Define Content-Type (chainable).

```typescript
res.type('application/xml').send('<xml/>');
```

### Sending Responses

#### `json<T>(data: T): void`

Envia resposta JSON.

**Features:**

- Auto-define `Content-Type: application/json; charset=utf-8`
- **Escape HTML automático** (previne XSS)
- Type-safe

```typescript
res.json({ users: [] });
res.status(201).json({ id: 123, name: 'John' });

// Type inference
interface User { id: number; name: string }
res.json<User>({ id: 1, name: 'John' });
```

#### `text(data: string): void`

Envia resposta de texto.

```typescript
res.text('Hello World');
res.status(200).text('Success');
```

#### `html(data: string): void`

Envia resposta HTML.

```typescript
res.html('<h1>Hello</h1>');
res.html(`
  <!DOCTYPE html>
  <html>
    <body>Hello</body>
  </html>
`);
```

#### `send(data?: unknown): void`

Envia resposta com auto-detecção de tipo.

```typescript
res.send({ json: 'object' });      // JSON
res.send('<html>');                // HTML
res.send('text');                  // Text
res.send(Buffer.from('data'));     // Binary
res.send();                        // Empty (204)
```

#### `redirect(url: string, statusCode?: HttpStatusCode): void`

Redireciona para URL.

```typescript
res.redirect('/login');                    // 302 Found
res.redirect('/login', 301);               // 301 Moved Permanently
res.redirect('https://example.com', 307);  // 307 Temporary Redirect
```

### Streaming

#### `write(chunk: string | Buffer): boolean`

Escreve chunk sem finalizar response.

```typescript
res.write('chunk1');
res.write('chunk2');
res.end();
```

#### `end(data?: string | Buffer): void`

Finaliza response opcionalmente enviando dados.

```typescript
res.end();
res.end('final data');
```

### Cookies

#### `cookie(name: string, value: string, options?: CookieOptions): Response`

Define um cookie (chainable).

```typescript
res.cookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 86400,    // 24h em segundos
  sameSite: 'Strict'
});
```

**CookieOptions:**

```typescript
interface CookieOptions {
  domain?: string;
  path?: string;              // Default: '/'
  expires?: Date;
  maxAge?: number;            // Em segundos
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}
```

#### `clearCookie(name: string, options?: CookieOptions): Response`

Remove um cookie.

```typescript
res.clearCookie('session');
res.clearCookie('session', { path: '/admin' });
```

---

## Middleware

### MiddlewareChain

Gerencia cadeia de middleware.

```typescript
import { MiddlewareChain } from 'like-express-node-typescript';

const chain = new MiddlewareChain();
chain.use(middleware1);
chain.use(middleware2);

await chain.execute(req, res);
```

### Composition Utilities

#### `compose(...middlewares): Middleware`

Combina múltiplos middleware em um.

```typescript
import { compose } from 'like-express-node-typescript';

const combined = compose(
  middleware1,
  middleware2,
  middleware3
);

app.use(combined);
```

#### `createMiddleware(fn): Middleware`

Converte função async para middleware (auto-chama next).

```typescript
import { createMiddleware } from 'like-express-node-typescript';

const mw = createMiddleware(async (req, res) => {
  console.log('Log');
  // next() é chamado automaticamente
});
```

#### `conditional(condition, middleware): Middleware`

Executa middleware apenas se condição for true.

```typescript
import { conditional } from 'like-express-node-typescript';

app.use(conditional(
  (req) => req.path.startsWith('/admin'),
  authMiddleware
));
```

#### `onlyMethods(methods[], middleware): Middleware`

Executa middleware apenas para métodos específicos.

```typescript
import { onlyMethods } from 'like-express-node-typescript';

app.use(onlyMethods(
  ['POST', 'PUT', 'PATCH'],
  bodyParser
));
```

#### `onlyPaths(pattern, middleware): Middleware`

Executa middleware apenas para paths que correspondem ao pattern.

```typescript
import { onlyPaths } from 'like-express-node-typescript';

app.use(onlyPaths('/api', apiMiddleware));
app.use(onlyPaths(/^\/admin/, adminMiddleware));
```

---

## Context

Sistema de contexto usando AsyncLocalStorage do Node.js.

**Benefício:** Acesse request/response de qualquer lugar no call stack sem passar explicitamente.

### Métodos de Acesso

#### `getRequest(): RequestContext`

Obtém request atual.

```typescript
import { context } from 'like-express-node-typescript';

function someDeepFunction() {
  const req = context.getRequest();
  console.log(req.path);
}
```

#### `getResponse(): ResponseContext`

Obtém response atual.

```typescript
const res = context.getResponse();
res.header('X-Custom', 'value');
```

#### `getRequestId(): string`

Obtém UUID auto-gerado do request.

```typescript
const requestId = context.getRequestId();
// 'a1b2c3d4-e5f6-...'
```

#### `getElapsedTime(): number`

Obtém tempo decorrido desde início do request (ms).

```typescript
const elapsed = context.getElapsedTime();
console.log(`Request took ${elapsed}ms`);
```

### Metadata Storage

#### `set(key: string, value: unknown): void`

Armazena metadata custom no contexto.

```typescript
context.set('userId', 123);
context.set('role', 'admin');
```

#### `get<T>(key: string): T | undefined`

Recupera metadata do contexto.

```typescript
const userId = context.get<number>('userId');
const role = context.get<string>('role');
```

### Utilities

#### `hasContext(): boolean`

Verifica se está dentro de um contexto de request.

```typescript
if (context.hasContext()) {
  const req = context.getRequest();
}
```

### Context Middleware

#### `requestIdMiddleware(): Middleware`

Adiciona header `X-Request-ID` na response.

```typescript
app.use(requestIdMiddleware());
```

#### `performanceMiddleware(): Middleware`

Adiciona header `X-Response-Time` com tempo de execução.

```typescript
app.use(performanceMiddleware());
```

---

## Validation

Sistema de validação integrado com Zod.

### Validation Middleware

#### `validate(schema): Middleware`

Cria middleware de validação.

```typescript
import { validate, z } from 'like-express-node-typescript';

const schema = {
  body: z.object({
    name: z.string(),
    email: z.string().email()
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({
    page: z.coerce.number().default(1)
  }),
  headers: z.object({
    'authorization': z.string().startsWith('Bearer ')
  })
};

app.post('/users/:id', {
  middleware: [validate(schema)]
}, (req, res) => {
  // req.body, req.params, req.query validados e tipados!
});
```

### Schema Builders

#### `body<T>(schema): ValidationSchema`

Schema apenas para body.

```typescript
import { body, z } from 'like-express-node-typescript';

app.post('/users', {
  middleware: [validate(body(z.object({
    name: z.string()
  })))]
}, handler);
```

#### `params<T>(schema): ValidationSchema`

Schema apenas para params.

```typescript
import { params, commonSchemas } from 'like-express-node-typescript';

app.get('/users/:id', {
  middleware: [validate(params(commonSchemas.uuidId))]
}, handler);
```

#### `query<T>(schema): ValidationSchema`

Schema apenas para query.

```typescript
import { query, z } from 'like-express-node-typescript';

app.get('/users', {
  middleware: [validate(query(z.object({
    search: z.string().optional()
  })))]
}, handler);
```

#### `headers<T>(schema): ValidationSchema`

Schema apenas para headers.

```typescript
import { headers, z } from 'like-express-node-typescript';

app.get('/protected', {
  middleware: [validate(headers(z.object({
    authorization: z.string()
  })))]
}, handler);
```

#### `combine(...schemas): ValidationSchema`

Combina múltiplos schemas.

```typescript
import { combine, body, query, z } from 'like-express-node-typescript';

const schema = combine(
  body(z.object({ name: z.string() })),
  query(z.object({ source: z.string() }))
);
```

### Common Schemas

Schemas pré-construídos para casos comuns.

```typescript
import { commonSchemas } from 'like-express-node-typescript';

// ID numérico
commonSchemas.numericId
// { id: z.coerce.number().int().positive() }

// UUID
commonSchemas.uuidId
// { id: z.string().uuid() }

// String ID
commonSchemas.stringId
// { id: z.string().min(1) }

// Paginação
commonSchemas.pagination
// { page: z.coerce.number().default(1), limit: z.coerce.number().default(10) }

// Ordenação
commonSchemas.sorting
// { sortBy: z.string().optional(), sortOrder: z.enum(['asc', 'desc']).default('asc') }

// Email
commonSchemas.email
// { email: z.string().email() }

// Timestamps
commonSchemas.timestamps
// { createdAt: z.string().datetime().optional(), updatedAt: z.string().datetime().optional() }
```

**Uso:**

```typescript
app.get('/users', {
  middleware: [validate({
    query: commonSchemas.pagination
  })]
}, (req, res) => {
  const { page, limit } = req.query; // Tipados!
});
```

### Utilities

#### `formatZodError(error): FormattedError`

Formata erro do Zod de forma amigável.

```typescript
import { formatZodError } from 'like-express-node-typescript';

const result = schema.safeParse(data);
if (!result.success) {
  const formatted = formatZodError(result.error);
  res.status(400).json({ errors: formatted });
}
```

---

## Security

### CORS

Cross-Origin Resource Sharing middleware.

#### `cors(options?): Middleware`

```typescript
import { cors } from 'like-express-node-typescript';

app.use(cors({
  origin: 'https://example.com',
  methods: ['GET', 'POST'],
  credentials: true,
  maxAge: 86400
}));
```

**CorsOptions:**

```typescript
interface CorsOptions {
  origin?: string | string[] | RegExp | ((origin: string) => boolean) | '*';
  methods?: string[];           // Default: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
  allowedHeaders?: string[];    // Default: echoes Access-Control-Request-Headers
  exposedHeaders?: string[];
  credentials?: boolean;        // Default: false
  maxAge?: number;              // Default: 86400 (24h)
  optionsSuccessStatus?: number; // Default: 204
  preflightContinue?: boolean;  // Default: false
}
```

**Origin Examples:**

```typescript
// String
cors({ origin: 'https://example.com' })

// Array
cors({ origin: ['https://example.com', 'https://app.com'] })

// Regex
cors({ origin: /\.example\.com$/ })

// Function
cors({ origin: (origin) => origin.endsWith('.trusted.com') })

// All
cors({ origin: '*' })
```

#### CORS Presets

```typescript
import { corsPresets } from 'like-express-node-typescript';

// Desenvolvimento - permite tudo
app.use(corsPresets.development());

// Produção - apenas origins específicas
app.use(corsPresets.production(['https://example.com']));

// API pública - sem credentials
app.use(corsPresets.publicApi());
```

### Helmet

Security headers middleware.

#### `helmet(options?): Middleware`

```typescript
import { helmet } from 'like-express-node-typescript';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'trusted.com']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

**HelmetOptions:**

```typescript
interface HelmetOptions {
  contentSecurityPolicy?: false | {
    directives?: Record<string, string[]>;
  };
  dnsPrefetchControl?: false | { allow?: boolean };
  frameguard?: false | { action?: 'deny' | 'sameorigin' };
  hidePoweredBy?: boolean;      // Default: true
  hsts?: false | {
    maxAge?: number;            // Default: 15552000 (180 days)
    includeSubDomains?: boolean; // Default: true
    preload?: boolean;
  };
  noSniff?: boolean;            // Default: true
  permittedCrossDomainPolicies?: false | { permittedPolicies?: string };
  referrerPolicy?: false | { policy?: string }; // Default: 'no-referrer'
  xssFilter?: boolean;          // Default: true
}
```

#### Helmet Presets

```typescript
import { helmetPresets } from 'like-express-node-typescript';

// Recomendado para produção
app.use(helmetPresets.default());

// Estrito (CSP rígido, frame deny)
app.use(helmetPresets.strict());

// Desenvolvimento (relaxado)
app.use(helmetPresets.development());

// Mínimo (apenas headers básicos)
app.use(helmetPresets.minimal());
```

### Rate Limiting

#### `rateLimit(options?): Middleware`

```typescript
import { rateLimit } from 'like-express-node-typescript';

app.use(rateLimit({
  max: 100,                    // 100 requests
  windowMs: 15 * 60 * 1000,    // Por 15 minutos
  message: 'Too many requests'
}));
```

**RateLimitOptions:**

```typescript
interface RateLimitOptions {
  max?: number;                 // Default: 100
  windowMs?: number;            // Default: 900000 (15 min)
  message?: string;
  statusCode?: HttpStatusCode;  // Default: 429
  keyGenerator?: (req) => string; // Default: IP-based
  handler?: (req, res) => void; // Handler customizado
  skip?: (req) => boolean;      // Pular para certos requests
  standardHeaders?: boolean;    // Default: true (RateLimit-* headers)
  legacyHeaders?: boolean;      // Default: false (X-RateLimit-*)
  store?: RateLimitStore;       // Store customizado
}
```

#### Rate Limit Presets

```typescript
import { rateLimitPresets } from 'like-express-node-typescript';

// Estrito - 20 req/15min
app.use(rateLimitPresets.strict());

// Moderado - 100 req/15min
app.use(rateLimitPresets.moderate());

// Relaxado - 1000 req/15min
app.use(rateLimitPresets.relaxed());

// Autenticação - 5 req/15min
app.post('/login', {
  middleware: [rateLimitPresets.auth()]
}, handler);

// Criação - 10 req/1min
app.post('/users', {
  middleware: [rateLimitPresets.create()]
}, handler);
```

#### Specialized Rate Limiters

##### `rateLimitByUser(options?): Middleware`

Rate limit por user ID (requer `req.user`).

```typescript
import { rateLimitByUser } from 'like-express-node-typescript';

app.use(rateLimitByUser({ max: 50 }));
```

##### `rateLimitByRoute(options?): Middleware`

Rate limit por IP + route path.

```typescript
import { rateLimitByRoute } from 'like-express-node-typescript';

app.use(rateLimitByRoute());
```

---

## Plugins

Sistema de plugins para encapsular funcionalidades.

### Plugin Builder

#### `createPlugin(name): PluginBuilder`

```typescript
import { createPlugin } from 'like-express-node-typescript';

const myPlugin = createPlugin('my-plugin')
  .middleware(cors())
  .middleware(helmet())
  .route('GET', '/health', (req, res) => {
    res.json({ status: 'ok' });
  })
  .onInstall((app) => {
    console.log('Plugin installed!');
  })
  .build();

await app.plugin(myPlugin);
```

### Built-in Plugins

#### `plugins.logging(options?)`

Logging completo de requests/responses.

```typescript
import { plugins } from 'like-express-node-typescript';

await app.plugin(plugins.logging({
  includeHeaders: false,
  includeBody: false,
  performanceThreshold: 1000  // Log slow requests > 1s
}));
```

#### `plugins.security(options?)`

Bundle de segurança (CORS + Helmet + Rate Limit).

```typescript
await app.plugin(plugins.security({
  corsOptions: { origin: '*' },
  helmetOptions: {},
  rateLimitOptions: { max: 100 }
}));
```

#### `plugins.healthCheck(options?)`

Endpoint de health check.

```typescript
await app.plugin(plugins.healthCheck({
  path: '/health',
  customCheck: async () => {
    // Check database, etc.
    return { status: 'healthy', db: 'connected' };
  }
}));

// GET /health
// { "status": "healthy", "uptime": 12345, "timestamp": "..." }
```

#### `plugins.metrics(options?)`

Endpoint de métricas básicas.

```typescript
await app.plugin(plugins.metrics({
  path: '/metrics'
}));

// GET /metrics
// {
//   "uptime": 12345,
//   "requests": 1000,
//   "errors": 5,
//   "errorRate": 0.005
// }
```

#### `plugins.bodyParser()`

Body parsing (já é automático, mantido para compatibilidade).

```typescript
await app.plugin(plugins.bodyParser());
```

---

## Error Handling

### Error Handler Creators

#### `createErrorHandler(options): ErrorHandler`

Cria handler de erros JSON.

```typescript
import { createErrorHandler } from 'like-express-node-typescript';

const app = createApp({
  errorHandler: createErrorHandler({
    debug: process.env.NODE_ENV === 'development',
    logger: (error, req) => {
      myLogger.error(error, {
        method: req.method,
        path: req.path
      });
    }
  })
});
```

#### `createHtmlErrorHandler(options): ErrorHandler`

Cria handler de erros HTML.

```typescript
import { createHtmlErrorHandler } from 'like-express-node-typescript';

const app = createApp({
  errorHandler: createHtmlErrorHandler({
    debug: true  // Mostra stack trace
  })
});
```

### Error Wrappers

#### `asyncHandler<T>(fn): T`

Wrapper para handlers async (captura erros automaticamente).

```typescript
import { asyncHandler } from 'like-express-node-typescript';

app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);
  // Erros são capturados automaticamente
}));
```

#### `errorBoundary(handler): Middleware`

Middleware error boundary.

```typescript
import { errorBoundary } from 'like-express-node-typescript';

app.use(errorBoundary((req, res, next) => {
  // Erros aqui são capturados
  throw new Error('Oops');
}));
```

### HttpError Helpers

#### `createError.*`

Helpers para criar erros HTTP comuns.

```typescript
import { createError } from 'like-express-node-typescript';

// 400 Bad Request
throw createError.badRequest('Invalid input', { field: 'email' });

// 401 Unauthorized
throw createError.unauthorized();

// 403 Forbidden
throw createError.forbidden('Access denied');

// 404 Not Found
throw createError.notFound('User not found');

// 405 Method Not Allowed
throw createError.methodNotAllowed('POST not allowed');

// 409 Conflict
throw createError.conflict('Email already exists');

// 422 Unprocessable Entity
throw createError.unprocessable('Validation failed', errors);

// 429 Too Many Requests
throw createError.tooManyRequests();

// 500 Internal Server Error
throw createError.internal('Something went wrong');

// 501 Not Implemented
throw createError.notImplemented('Feature not available');

// 503 Service Unavailable
throw createError.serviceUnavailable('Maintenance');
```

### HttpError Class

```typescript
import { HttpError } from 'like-express-node-typescript';

throw new HttpError(404, 'Not found', { id: 123 });

// Properties:
error.statusCode  // 404
error.message     // 'Not found'
error.details     // { id: 123 }
```

---

## Logger

Sistema de logging com níveis e cores.

### Logger Class

```typescript
import { Logger, LogLevel } from 'like-express-node-typescript';

const logger = new Logger({
  level: LogLevel.DEBUG,
  timestamp: true,
  colors: true,
  prefix: '[MyApp]'
});
```

### Log Methods

```typescript
logger.debug('Debug message');    // Cinza
logger.info('Info message');      // Azul
logger.warn('Warning message');   // Amarelo
logger.error('Error message');    // Vermelho
```

### Log Level

```typescript
logger.setLevel(LogLevel.WARN);  // Apenas WARN e ERROR
logger.setLevel(LogLevel.DEBUG); // Todos os logs

const level = logger.getLevel();
```

**Níveis:**

- `LogLevel.DEBUG` (0) - Mais detalhado
- `LogLevel.INFO` (1)
- `LogLevel.WARN` (2)
- `LogLevel.ERROR` (3)
- `LogLevel.SILENT` (4) - Nenhum log

### Logger Middleware

#### `requestLogger(options?): Middleware`

Log de todos os requests/responses.

```typescript
import { requestLogger } from 'like-express-node-typescript';

app.use(requestLogger({
  logger: myLogger,
  includeHeaders: true,
  includeBody: false
}));

// [2024-01-01 12:00:00] GET /users 200 - 45ms
```

#### `performanceLogger(options?): Middleware`

Log apenas de requests lentos.

```typescript
import { performanceLogger } from 'like-express-node-typescript';

app.use(performanceLogger({
  threshold: 1000  // Apenas se > 1s
}));

// [WARN] Slow request: GET /users - 1234ms
```

### Global Logger

```typescript
import { logger } from 'like-express-node-typescript';

logger.info('Server starting...');
logger.error('Something went wrong!');
```

### Create Logger

```typescript
import { createLogger } from 'like-express-node-typescript';

const dbLogger = createLogger('[DB]', { level: LogLevel.DEBUG });
dbLogger.info('Query executed');  // [DB] Query executed
```

---

## JSON Utilities

### Stringify

Serialização JSON segura com escape HTML.

#### `stringify(value, options?): string`

```typescript
import { stringify } from 'like-express-node-typescript';

// Básico
const json = stringify({ name: 'John' });

// Com formatação
const json = stringify(data, {
  space: 2,
  escapeHtml: true
});

// Com replacer
const json = stringify(data, {
  replacer: (key, value) => {
    if (key === 'password') return undefined;
    return value;
  },
  escapeHtml: true
});

// Segurança XSS
const unsafe = { html: '<script>alert("XSS")</script>' };
const safe = stringify(unsafe, { escapeHtml: true });
// {"html":"\u003cscript\u003ealert(\"XSS\")\u003c/script\u003e"}
```

**StringifyOptions:**

```typescript
interface StringifyOptions {
  replacer?: (key: string, value: unknown) => unknown | (number | string)[] | null;
  space?: string | number;
  escapeHtml?: boolean;        // Default: false
}
```

---

## Types & Constants

### HTTP Status Codes

```typescript
import { HttpStatus } from 'like-express-node-typescript';

// Success
HttpStatus.OK                      // 200
HttpStatus.CREATED                 // 201
HttpStatus.NO_CONTENT              // 204

// Redirection
HttpStatus.MOVED_PERMANENTLY       // 301
HttpStatus.FOUND                   // 302
HttpStatus.NOT_MODIFIED            // 304

// Client Errors
HttpStatus.BAD_REQUEST             // 400
HttpStatus.UNAUTHORIZED            // 401
HttpStatus.FORBIDDEN               // 403
HttpStatus.NOT_FOUND               // 404
HttpStatus.METHOD_NOT_ALLOWED      // 405
HttpStatus.CONFLICT                // 409
HttpStatus.UNPROCESSABLE_ENTITY    // 422
HttpStatus.TOO_MANY_REQUESTS       // 429

// Server Errors
HttpStatus.INTERNAL_SERVER_ERROR   // 500
HttpStatus.NOT_IMPLEMENTED         // 501
HttpStatus.BAD_GATEWAY             // 502
HttpStatus.SERVICE_UNAVAILABLE     // 503
```

### Type Exports

```typescript
import type {
  HttpMethod,
  HttpStatusCode,
  RouteParams,
  QueryParams,
  Headers,
  Handler,
  Middleware,
  NextFunction,
  ErrorHandler,
  RequestContext,
  ResponseContext,
  Route,
  ValidationSchema,
  Plugin,
  ApplicationOptions,
} from 'like-express-node-typescript';
```

---

## Factory Function

### createApp

Função principal para criar instância da aplicação.

```typescript
import { createApp } from 'like-express-node-typescript';

const app = createApp({
  port: 3000,
  host: '0.0.0.0',
  debug: true,
  trustProxy: true,
  errorHandler: myErrorHandler
});
```

---

## Resumo de Features

### Total de APIs Públicas

- **Application**: 14 métodos
- **Router**: 13 métodos
- **Request**: 11 métodos
- **Response**: 16 métodos
- **Middleware**: 6 utilities
- **Context**: 10 métodos
- **Validation**: 6 utilities + 8 schemas comuns
- **CORS**: 1 função + 3 presets
- **Helmet**: 1 função + 4 presets
- **Rate Limiting**: 3 funções + 5 presets
- **Plugins**: 5 built-in + builder API
- **Error Handling**: 13 helpers + classe HttpError
- **Logger**: 4 métodos de log + 2 middleware
- **JSON**: 1 função stringify
- **Types**: 20+ exports
- **HTTP Status**: 18 constantes

### Capacidades Principais

1. ✅ **Type Inference Completa** com schemas Zod
2. ✅ **Async/Await** nativo em todo o framework
3. ✅ **Zero Dependencies** exceto Zod e find-my-way
4. ✅ **AsyncLocalStorage** para propagação de contexto
5. ✅ **Segurança Built-in** (CORS, Helmet, Rate Limiting)
6. ✅ **Error Handling** abrangente
7. ✅ **Plugin Architecture** extensível
8. ✅ **Streaming** support
9. ✅ **Cookie Management** completo
10. ✅ **Request/Response Logging**
11. ✅ **Performance Monitoring**
12. ✅ **Health Checks e Metrics**
13. ✅ **JSON XSS Protection** automático
14. ✅ **Router de Alta Performance** (find-my-way)

---

**LikeExpress** - Framework moderno, type-safe e production-ready para Node.js! 🚀
