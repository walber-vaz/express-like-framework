# LikeExpress

**Um framework web moderno para Node.js, inspirado no Express mas com TypeScript e ES Modules nativos.**

LikeExpress combina a familiaridade da API do Express com recursos modernos do Node.js e TypeScript. Ideal para desenvolvedores que querem a simplicidade do Express com a segurança de tipos do TypeScript e as melhores práticas de segurança incluídas por padrão.

## ⚡ Por que LikeExpress?

- **Familiar**: Se você já usa Express, a transição é instantânea
- **Moderno**: ES Modules nativos, TypeScript-first, Node.js 18+
- **Seguro**: CORS, Helmet, Rate Limiting configurados e prontos
- **Produtivo**: Validação com Zod, schemas reutilizáveis, autocomplete perfeito
- **Zero Config**: Funciona out-of-the-box, customize quando necessário

## ✨ Características

### 🚀 TypeScript-First & Type Inference: Sua API Tipada Automaticamente

LikeExpress leva o "TypeScript-First" a sério. Ao definir schemas de validação com Zod, sua aplicação não apenas valida os dados de entrada, mas também infere automaticamente os tipos corretos para `req.body`, `req.params` e `req.query` nos seus handlers. Isso significa:

- **Segurança Total**: Seus dados de entrada sempre corresponderão aos seus tipos.
- **DX Imbatível**: Autocomplete instantâneo e feedback de erros em tempo de desenvolvimento.
- **Menos Boileplate**: Diga adeus às tipagens manuais de `req` e `res`.

**Exemplo Mágico de Inferência de Tipos:**

```typescript
import { createApp, z } from 'like-express-node-typescript';

const app = createApp();

const getUserSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    include: z.enum(['profile', 'posts']).optional(),
  }),
} as const; // Crucial para a inferência de tipos!

app.get('/users/:id', (req, res) => {
  // ✨ req.params é automaticamente inferido como: { id: string }
  const userId = req.params.id; // Autocomplete completo!

  // ✨ req.query é automaticamente inferido como: { include?: "profile" | "posts" }
  const includeData = req.query.include; // Tipagem precisa!

  res.json({ userId, includeData });
}, { schema: getUserSchema });

app.listen().then(() => console.log('Servidor rodando com tipagem mágica! ✨'));
```

Com `LikeExpress`, seus handlers são sempre tipados e seguros, sem esforço extra!

---

- ⚡ **ES Modules Nativos**: Arquitetura moderna do Node.js
- 🔋 **Baterias Inclusas**: Validação, segurança, logging built-in
- 🎯 **API Familiar**: Se você conhece Express, já sabe usar
- 🛡️ **Seguro por Padrão**: CORS, Helmet, Rate Limiting inclusos
- 🔍 **Developer Experience**: Erros claros, debugging fácil


## 📋 Pré-requisitos

- Node.js 18+ (para suporte a ES Modules, fetch nativo, e node:test)
- npm ou yarn
- TypeScript 5.9+

## 📦 Instalação

### Desenvolvimento

```bash
# Clone o repositório
git clone <repository-url>
cd like-express-node-typescript

# Instale as dependências
npm install

# Execute o exemplo
npm run dev

# Compile o projeto
npm run build
```

### Uso como Pacote (em breve)

```bash
npm install like-express-node-typescript
```

## 🚀 Quick Start

```typescript
import { createApp, z, validate } from 'like-express-node-typescript';

const app = createApp();

// Rota simples
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Rota com validação
app.post('/users', {
  middleware: [validate({
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  })]
}, (req, res) => {
  res.json({ user: req.body });
});

app.listen(3000);
```

## 📚 Documentação

### Criando uma Aplicação

```typescript
import { createApp } from 'like-express-node-typescript';

const app = createApp({
  port: 3000,
  host: 'localhost',
  debug: true, // Logs detalhados
  trustProxy: false // Headers X-Forwarded-*
});
```

### Rotas

```typescript
// Métodos HTTP
app.get('/path', handler);
app.post('/path', handler);
app.put('/path', handler);
app.patch('/path', handler);
app.delete('/path', handler);
app.head('/path', handler);
app.options('/path', handler);

// Parâmetros de rota
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ userId: id });
});

// Query parameters
app.get('/search', (req, res) => {
  const { q, page } = req.query;
  res.json({ query: q, page });
});
```

### Validação com Zod

```typescript
import { z, validate } from 'like-express-node-typescript';

const userSchema = {
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    age: z.number().int().positive().optional()
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10)
  })
};

app.post('/users/:id', {
  middleware: [validate(userSchema)]
}, (req, res) => {
  // req.body, req.params, req.query já validados e tipados!
  res.json({ user: req.body });
});
```

### Middleware

```typescript
import { cors, helmet, rateLimit } from 'like-express-node-typescript';

// Middleware global
app.use(cors());
app.use(helmet());
app.use(rateLimit({ max: 100, windowMs: 60000 }));

// Middleware customizado
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Middleware em rotas específicas
app.post('/api', {
  middleware: [
    rateLimit({ max: 10, windowMs: 60000 })
  ]
}, handler);
```

### Segurança

#### CORS

```typescript
import { cors, corsPresets } from 'like-express-node-typescript';

// Desenvolvimento - permite tudo
app.use(corsPresets.development());

// Produção - apenas origins específicas
app.use(corsPresets.production(['https://example.com']));

// Customizado
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true,
  maxAge: 86400
}));
```

#### Security Headers (Helmet)

```typescript
import { helmet, helmetPresets } from 'like-express-node-typescript';

// Padrão recomendado
app.use(helmetPresets.default());

// Estrito para produção
app.use(helmetPresets.strict());

// Customizado
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'trusted.com']
    }
  }
}));
```

#### Rate Limiting

```typescript
import { rateLimit, rateLimitPresets } from 'like-express-node-typescript';

// Limite global
app.use(rateLimitPresets.moderate());

// Limite para autenticação
app.post('/login', {
  middleware: [rateLimitPresets.auth()]
}, handler);

// Customizado
app.use(rateLimit({
  max: 100, // 100 requests
  windowMs: 15 * 60 * 1000, // por 15 minutos
  message: 'Too many requests'
}));
```

### Error Handling

```typescript
import { HttpError, createError } from 'like-express-node-typescript';

// Lançar erros HTTP
app.get('/not-found', () => {
  throw createError.notFound('Resource not found');
});

// Error handler customizado
const app = createApp({
  errorHandler: (error, req, res) => {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
```

### Logging

```typescript
import { logger, requestLogger, LogLevel } from 'like-express-node-typescript';

// Logger global
logger.info('Server started');
logger.warn('Warning message');
logger.error('Error message');
logger.debug('Debug info');

// Request logging middleware
app.use(requestLogger({
  includeHeaders: true,
  includeBody: false
}));

// Configurar nível de log
logger.setLevel(LogLevel.DEBUG);
```

### Plugins

```typescript
import { plugins } from 'like-express-node-typescript';

// Plugin de logging completo
await app.plugin(plugins.logging({
  includeHeaders: false,
  performanceThreshold: 1000
}));

// Plugin de segurança (CORS + Helmet + Rate Limit)
await app.plugin(plugins.security());

// Health check endpoint
await app.plugin(plugins.healthCheck({
  path: '/health'
}));

// Métricas básicas
await app.plugin(plugins.metrics({
  path: '/metrics'
}));
```

### Response Helpers

```typescript
app.get('/api', (req, res) => {
  // JSON
  res.json({ data: 'value' });

  // Text
  res.text('Hello World');

  // HTML
  res.html('<h1>Hello</h1>');

  // Status code
  res.status(201).json({ created: true });

  // Redirect
  res.redirect('/new-path');

  // Headers
  res.header('X-Custom', 'value');
  res.setHeaders({
    'X-Custom-1': 'value1',
    'X-Custom-2': 'value2'
  });

  // Cookies
  res.cookie('session', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400
  });

  // Send auto-detect
  res.send({ auto: 'detected' }); // JSON
  res.send('<html>...</html>'); // HTML
  res.send(Buffer.from('data')); // Binary
});
```

### Request Helpers

```typescript
app.post('/api', async (req, res) => {
  // Body parsing automático
  const body = req.body;

  // Headers
  const auth = req.get('authorization');
  const hasAuth = req.has('authorization');

  // Content type
  if (req.isJson()) {
    // Handle JSON
  }

  if (req.accepts('application/json')) {
    // Client accepts JSON
  }

  // Client info
  const ip = req.ip();
  const host = req.hostname();
  const protocol = req.protocol();
  const fullUrl = req.fullUrl();

  // Seguro (HTTPS)?
  if (req.secure()) {
    // HTTPS connection
  }
});
```

### Async Context

```typescript
import { context } from 'like-express-node-typescript';

// Acesse request/response de qualquer lugar
function someDeepFunction() {
  const req = context.getRequest();
  const res = context.getResponse();
  const requestId = context.getRequestId();
  const elapsed = context.getElapsedTime();

  // Custom metadata
  context.set('userId', '123');
  const userId = context.get<string>('userId');
}
```

## 🎯 Schemas Comuns

```typescript
import { commonSchemas } from 'like-express-node-typescript';

// ID numérico
app.get('/users/:id', {
  middleware: [validate({ params: commonSchemas.numericId })]
}, handler);

// UUID
app.get('/posts/:id', {
  middleware: [validate({ params: commonSchemas.uuidId })]
}, handler);

// Paginação
app.get('/items', {
  middleware: [validate({ query: commonSchemas.pagination })]
}, (req, res) => {
  const { page, limit } = req.query; // tipados e validados
});

// Ordenação
app.get('/items', {
  middleware: [validate({ query: commonSchemas.sorting })]
}, handler);
```

## 🔧 Configuração Avançada

### Custom Error Handler

```typescript
import { createErrorHandler, createHtmlErrorHandler } from 'like-express-node-typescript';

const app = createApp({
  errorHandler: createErrorHandler({
    debug: process.env.NODE_ENV === 'development',
    logger: (error, req) => {
      // Custom logging
      myLogger.error(error, {
        method: req.method,
        path: req.path
      });
    }
  })
});
```

### Router Standalone

```typescript
import { Router } from 'like-express-node-typescript';

const router = new Router();

router.get('/users', handler);
router.post('/users', handler);

// Use com Application
const app = createApp();
app.use((req, res, next) => {
  // Middleware que usa router
  const match = router.match(req.method, req.path);
  if (match) {
    match.route.handler(req, res);
  } else {
    next();
  }
});
```

## 🛠️ Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev              # Executa examples/basic.ts com hot reload
npm run dev:watch        # Watch mode para desenvolvimento

# Build
npm run build            # Compila TypeScript para dist/
npm run build:clean      # Build limpo (remove dist/ primeiro)

# Qualidade de Código
npm run test             # Executa testes com node:test
npm run lint             # Verifica código com Biome
npm run format           # Formata código com Biome
npm run typecheck        # Verifica tipos TypeScript

# Verificação Completa
npm run check            # Executa lint + typecheck + test
```

## 📖 Exemplos

### Exemplo Básico

Execute o exemplo incluído no projeto:

```bash
npm run dev
```

O arquivo `examples/basic.ts` demonstra:

- Criação de aplicação com configuração
- Rotas HTTP (GET, POST, PUT, DELETE)
- Validação com Zod
- Middleware de segurança (CORS, Helmet, Rate Limiting)
- Plugins (logging, security, health check, metrics)
- Error handling
- Async context

### Criando Seu Próprio Exemplo

Crie um arquivo `my-app.ts`:

```typescript
import { createApp, type RequestContext, type ResponseContext } from './src/index.js';

const app = createApp({
  port: 3000,
  debug: true
});

app.get('/', (req: RequestContext, res: ResponseContext) => {
  res.json({ message: 'Minha aplicação LikeExpress!' });
});

await app.listen();
```

Execute com:

```bash
npx tsx my-app.ts
```

## 🏗️ Arquitetura

### Estrutura de Diretórios

```
src/
├── core/           # Core do framework
│   ├── application.ts  # Classe principal
│   ├── router.ts       # Sistema de rotas
│   ├── request.ts      # Request wrapper
│   ├── response.ts     # Response wrapper
│   ├── middleware.ts   # Sistema de middleware
│   └── context.ts      # Async context
├── validation/     # Validação com Zod
├── security/       # Middleware de segurança
│   ├── cors.ts
│   ├── helmet.ts
│   └── rate-limit.ts
├── utils/          # Utilitários
│   ├── types.ts
│   ├── logger.ts
│   └── error-handler.ts
└── plugins/        # Sistema de plugins
```

### Stack Tecnológico

| Componente | Tecnologia | Versão |
|------------|-----------|--------|
| Runtime | Node.js | 18+ |
| Linguagem | TypeScript | 5.9+ |
| Module System | ES Modules | Nativo |
| Validação | Zod | 3.24+ |
| Test Runner | node:test | Nativo |
| Linter/Formatter | Biome | Latest |
| Build Tool | TSC | 5.9+ |

### Princípios de Design

1. **TypeScript-First**: Toda a API é projetada para máxima inferência de tipos
2. **Zero Dependencies**: Apenas Zod como dependência externa (exceto devDependencies)
3. **Express-Compatible**: API familiar para fácil migração
4. **Modern Node.js**: Aproveita recursos nativos (fetch, test runner, AsyncLocalStorage)
5. **Seguro por Padrão**: Segurança não é opcional, é built-in

## 📊 Status do Projeto

### Funcionalidades Implementadas

- ✅ Sistema de roteamento com pattern matching
- ✅ Middleware chain com suporte async
- ✅ Request/Response wrappers type-safe
- ✅ Validação com Zod
- ✅ CORS middleware com presets
- ✅ Helmet (security headers) com presets
- ✅ Rate limiting in-memory
- ✅ Sistema de plugins
- ✅ Async context (AsyncLocalStorage)
- ✅ Logger com níveis
- ✅ Error handling customizável
- ✅ Common schemas (pagination, UUID, etc.)

### Roadmap

- 🔲 Upload de arquivos (multipart/form-data)
- 🔲 WebSocket support
- 🔲 Template engines
- 🔲 Geração de OpenAPI/Swagger
- 🔲 Rate limit com stores externos (Redis)
- 🔲 Clustering support
- 🔲 Compression middleware
- 🔲 Static file serving
- 🔲 Suite de testes completa

## 🤝 Contribuindo

Contribuições são bem-vindas!

### Para Desenvolvedores

Se você é desenvolvedor e quer contribuir:

1. **Leia o CLAUDE.md** - Guia completo da arquitetura e convenções do código
2. Fork o projeto
3. Crie uma branch para sua feature (`git checkout -b feature/amazing`)
4. Faça suas alterações seguindo as convenções do projeto
5. Execute os checks: `npm run check`
6. Commit suas mudanças usando [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - Nova funcionalidade
   - `fix:` - Correção de bug
   - `docs:` - Documentação
   - `refactor:` - Refatoração
   - `test:` - Testes
   - `chore:` - Manutenção
7. Push para a branch (`git push origin feature/amazing`)
8. Abra um Pull Request

### Para IA (Claude Code e outros)

Se você é uma instância de Claude Code ou outro assistente de IA trabalhando neste projeto:

**📘 Leia primeiro o arquivo [CLAUDE.md](./CLAUDE.md)** - Ele contém informações essenciais sobre:

- Arquitetura do framework
- Padrões de código
- Problemas comuns e soluções
- Convenções de nomenclatura
- TypeScript strict mode gotchas
- Fluxo de desenvolvimento

### Diretrizes de Código

- **TypeScript Strict**: Mantenha o modo strict ativado
- **ES Modules**: Use imports com extensão `.js`
- **Formatação**: Use Biome (`npm run format`)
- **Testes**: Adicione testes para novas features
- **Documentação**: Atualize README.md e CLAUDE.md se necessário

## 📝 Licença

ISC

## 🙏 Agradecimentos

Inspirado por:

- Express.js - API familiar e robusta
- Fastify - Performance e arquitetura moderna
- Hono - Simplicidade e leveza
- NestJS - TypeScript e estrutura

---

**Feito com ❤️ e TypeScript**
