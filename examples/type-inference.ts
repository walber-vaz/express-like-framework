import {
  type RequestContext,
  type ResponseContext,
  createApp,
  z,
} from '../dist/index.js';

const app = createApp({ port: 3003 });

/**
 * Exemplo 1: Body inference (POST)
 */
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
    // ✨ req.body é automaticamente inferido como:
    // { name: string; email: string; age?: number }
    const { name, email, age } = req.body;

    res.json({
      created: { name, email, age },
      // Autocomplete funciona perfeitamente! 🎉
    });
  },
  { schema: createUserSchema },
);

/**
 * Exemplo 2: Params + Query inference (GET)
 */
const getUserSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    include: z.enum(['profile', 'posts', 'comments']).optional(),
    limit: z.coerce.number().int().positive().default(10),
  }),
} as const;

app.get(
  '/users/:id',
  (req, res) => {
    // ✨ req.params é automaticamente inferido como: { id: string }
    // ✨ req.query é automaticamente inferido como:
    //    { include?: "profile" | "posts" | "comments"; limit: number }
    const userId = req.params.id;
    const include = req.query.include;
    const limit = req.query.limit;

    res.json({
      userId, // string (UUID)
      include, // "profile" | "posts" | "comments" | undefined
      limit, // number
    });
  },
  { schema: getUserSchema },
);

/**
 * Exemplo 3: Body + Params inference (PUT)
 */
const updateUserSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
  }),
} as const;

app.put(
  '/users/:id',
  (req, res) => {
    // ✨ Ambos inferidos automaticamente!
    const userId = req.params.id; // string
    const updates = req.body; // { name?: string; email?: string }

    res.json({
      updated: userId,
      changes: updates,
    });
  },
  { schema: updateUserSchema },
);

/**
 * Exemplo 4: Sem schema = tipos genéricos (retrocompatibilidade)
 */
app.get('/legacy', (_req: RequestContext, res: ResponseContext) => {
  // req.body: unknown
  // req.params: Record<string, string>
  // req.query: Record<string, string | string[]>
  res.json({ message: 'Legacy route with generic types' });
});

app.listen().then(() => {
  console.log('Type inference examples running on port 3003');
  console.log('All types are inferred automatically from Zod schemas! 🎉');
});
