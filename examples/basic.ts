import {
  cors,
  createApp,
  logger,
  helmet,
  validate,
  z,
  type RequestContext,
  type ResponseContext,
} from '../dist/index.js';

// Cria a aplicação
const app = createApp({
  port: 3000,
  debug: true,
});

// Middleware global
app.use(cors());
app.use(helmet());

// Rota simples
app.get('/', (req: RequestContext, res: ResponseContext) => {
  res.json({ message: 'Hello from LikeExpress!' });
});

// Rota com parâmetros
app.get('/users/:id', (req: RequestContext, res: ResponseContext) => {
  res.json({
    userId: req.params.id,
    method: req.method,
    path: req.path,
  });
});

// Rota com validação e type inference automática
const createUserSchema = {
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    age: z.number().int().positive().optional(),
  }),
} as const;

app.post(
  '/users',
  (req, res) => {
    // req.body agora tem tipo inferido automaticamente! 🎉
    // Tipo: { name: string; email: string; age?: number }
    const user = req.body;
    logger.info('Creating user:', user);

    // Autocomplete funciona perfeitamente:
    console.log(user.name, user.email, user.age);

    res.status(201).json({
      message: 'User created',
      user,
    });
  },
  { middleware: [validate(createUserSchema)], schema: createUserSchema },
);

// Rota com query params
app.get('/search', (req: RequestContext, res: ResponseContext) => {
  res.json({
    query: req.query,
    page: req.query.page || '1',
    limit: req.query.limit || '10',
  });
});

// Error handling
app.get('/error', () => {
  throw new Error('Intentional error for testing');
});

// Inicia o servidor
app.listen().then(() => {
  console.log('✓ Server is ready!');
  console.log('Try these endpoints:');
  console.log('  GET  http://localhost:3000/');
  console.log('  GET  http://localhost:3000/users/123');
  console.log('  POST http://localhost:3000/users');
  console.log('  GET  http://localhost:3000/search?page=2&limit=20');
});
