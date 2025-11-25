# Security Best Practices for LikeExpress

This guide covers security best practices when using LikeExpress in production environments.

## Table of Contents

- [Rate Limiting](#rate-limiting)
- [Body Size Limits](#body-size-limits)
- [Proxy Configuration](#proxy-configuration)
- [CORS Security](#cors-security)
- [Request Timeout](#request-timeout)
- [File Uploads](#file-uploads)
- [HTTPS/TLS](#httpstls)
- [Input Validation](#input-validation)
- [Error Handling](#error-handling)

---

## Rate Limiting

### ⚠️ Production Warning

The built-in `MemoryStore` is **single-process only**. For production with multiple instances, use a distributed store:

```typescript
import Redis from 'ioredis';
import { rateLimit, type RateLimitStore, type RateLimitInfo } from 'like-express';

class RedisStore implements RateLimitStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    const resetTime = now + windowMs;

    // Usar transação Redis para operação atômica
    const count = await this.redis
      .multi()
      .incr(key)
      .pexpire(key, windowMs)
      .exec()
      .then(results => results?.[0]?.[1] as number || 1);

    return { count, resetTime };
  }
}

// Uso
app.use(rateLimit({
  store: new RedisStore(process.env.REDIS_URL!),
  max: 100,
  windowMs: 15 * 60 * 1000
}));
```

### Best Practices

```typescript
// ✅ GOOD: Different limits for different routes
app.use('/api/auth', rateLimitPresets.auth());     // 5 req/15min
app.use('/api/create', rateLimitPresets.create()); // 10 req/1min
app.use('/api', rateLimitPresets.moderate());      // 100 req/15min

// ❌ BAD: Same limit for everything
app.use(rateLimit({ max: 1000 })); // Too permissive
```

---

## Body Size Limits

### Always Set `maxBodySize`

Prevent DoS attacks by limiting request body size:

```typescript
const app = createApp({
  maxBodySize: 5 * 1024 * 1024, // 5MB
});
```

### Recommended Limits

| Use Case | Recommended Size |
|----------|-----------------|
| **API only (JSON)** | 1-5 MB |
| **Forms + small files** | 10-20 MB |
| **File upload service** | 50-100 MB |
| **Video/large files** | Custom per route |

### ⚠️ Security Impact

```typescript
// ❌ DANGEROUS: No limit
const app = createApp({
  maxBodySize: Number.MAX_SAFE_INTEGER
});
// Attacker can send infinite payload → OOM crash

// ✅ SAFE: Reasonable limit
const app = createApp({
  maxBodySize: 10 * 1024 * 1024 // 10MB
});
```

---

## Proxy Configuration

### Trust Proxy ONLY Behind Trusted Proxies

```typescript
// ✅ GOOD: Behind nginx/AWS ALB
const app = createApp({
  trustProxy: process.env.NODE_ENV === 'production',
});

// ❌ BAD: Always trusting proxy headers
const app = createApp({
  trustProxy: true, // Can be spoofed if not behind proxy!
});
```

### Why This Matters

When `trustProxy: true`, the framework trusts these headers:
- `X-Forwarded-For` (client IP)
- `X-Real-IP` (client IP)
- `X-Forwarded-Proto` (http/https)

**If not behind a proxy**, attackers can spoof these headers!

### Validation

The framework automatically validates IP formats to prevent spoofing:

```typescript
// Validated: Only accepts valid IPv4/IPv6
// ✅ "192.168.1.1"
// ✅ "2001:db8::1"
// ❌ "malicious-header"
// ❌ "192.999.1.1"
```

---

## CORS Security

### Never Use Wildcard with Credentials

```typescript
// ❌ INSECURE: Wildcard + credentials = security risk
app.use(cors({
  origin: '*',
  credentials: true
}));

// ✅ SECURE: Specific origins
app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true
}));
```

### Production CORS Configuration

```typescript
import { corsPresets } from 'like-express';

// Development
if (process.env.NODE_ENV === 'development') {
  app.use(corsPresets.development());
}

// Production
else {
  app.use(corsPresets.production([
    'https://yourdomain.com',
    'https://app.yourdomain.com'
  ]));
}
```

### Dynamic Origin Validation

```typescript
app.use(cors({
  origin: (origin) => {
    // Validate against allowed domains
    const allowedDomains = ['.yourdomain.com', '.partner.com'];
    return allowedDomains.some(domain => origin.endsWith(domain));
  },
  credentials: true
}));
```

---

## Request Timeout

### Prevent Slow Loris Attacks

```typescript
const app = createApp({
  requestTimeout: 30000, // 30 seconds
});
```

### Recommended Timeouts

| Route Type | Timeout |
|------------|---------|
| **Fast API** | 10-30s |
| **Database queries** | 30-60s |
| **File processing** | 2-5min |
| **Default** | 2min (120s) |

### Custom Timeout Per Route

```typescript
// Not built-in, but you can implement:
function withTimeout(ms: number): Middleware {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.finished) {
        res.status(408).json({ error: 'Request Timeout' });
      }
    }, ms);

    res.raw.on('finish', () => clearTimeout(timeout));
    next();
  };
}

app.post('/slow-operation',
  withTimeout(5 * 60 * 1000), // 5 minutes
  handler
);
```

---

## File Uploads

### Always Set Upload Limits

```typescript
app.post('/upload', async (req, res) => {
  const { files } = await req.parseMultipart({
    limits: {
      fileSize: 10 * 1024 * 1024,  // 10MB per file
      files: 5,                     // Max 5 files
      fields: 20,                   // Max 20 fields
      fieldSize: 1024 * 1024        // 1MB per field
    }
  });

  res.json({ uploaded: files.length });
});
```

### Validate File Types

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

app.post('/upload-image', async (req, res) => {
  const { files } = await req.parseMultipart({
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  // Validate MIME types
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw createError.badRequest(
        `Invalid file type: ${file.mimetype}`
      );
    }
  }

  // Validate file extensions
  for (const file of files) {
    const ext = file.filename.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      throw createError.badRequest(
        `Invalid file extension: ${ext}`
      );
    }
  }

  res.json({ message: 'Upload successful' });
});
```

### Scan for Malware

```typescript
import { createHash } from 'crypto';

app.post('/upload', async (req, res) => {
  const { files } = await req.parseMultipart();

  for (const file of files) {
    // Calculate hash
    const hash = createHash('sha256')
      .update(file.data)
      .digest('hex');

    // Check against known malware hashes
    // (integrate with virus scanning service)

    // Save securely (outside web root!)
    const safePath = `/secure-uploads/${hash}.${ext}`;
    await fs.writeFile(safePath, file.data);
  }

  res.json({ uploaded: files.length });
});
```

---

## HTTPS/TLS

### Always Use HTTPS in Production

```typescript
import { readFileSync } from 'fs';

const app = createApp({
  port: 443,
  tls: {
    key: readFileSync('/path/to/private-key.pem'),
    cert: readFileSync('/path/to/certificate.pem'),
    // Optional: CA certificates
    ca: readFileSync('/path/to/ca-bundle.pem'),
    // Recommended ciphers (strong security)
    ciphers: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256'
    ].join(':'),
    // Minimum TLS version
    minVersion: 'TLSv1.2',
  }
});
```

### Force HTTPS Middleware

```typescript
function forceHttps(): Middleware {
  return (req, res, next) => {
    if (!req.secure()) {
      const httpsUrl = `https://${req.hostname()}${req.url}`;
      res.redirect(httpsUrl, 301);
      return;
    }
    next();
  };
}

// Production only
if (process.env.NODE_ENV === 'production') {
  app.use(forceHttps());
}
```

---

## Input Validation

### Always Validate User Input

```typescript
import { z } from 'like-express';

// ✅ GOOD: Strict validation
const createUserSchema = {
  body: z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(72), // bcrypt limit
    name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
    age: z.number().int().min(13).max(120)
  })
} as const;

app.post('/users',
  (req, res) => {
    // req.body is fully validated and typed!
    const user = req.body;
    res.json({ created: user });
  },
  { schema: createUserSchema }
);
```

### Sanitize Output

```typescript
import { stringify } from 'like-express';

app.get('/user/:id', (req, res) => {
  const user = getUserFromDB(req.params.id);

  // Escape HTML in JSON (XSS protection)
  res.raw.setHeader('Content-Type', 'application/json');
  res.raw.end(stringify(user, { escapeHtml: true }));
});
```

---

## Error Handling

### Never Expose Stack Traces in Production

```typescript
const app = createApp({
  debug: process.env.NODE_ENV !== 'production',
  errorHandler: (error, req, res) => {
    // Log full error server-side
    console.error('[ERROR]', error);

    // Send safe error to client
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: error.message,
        statusCode: error.statusCode
        // NO stack trace, NO details
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        statusCode: 500
        // NO error message, NO stack
      });
    }
  }
});
```

### Use Structured Logging

```typescript
import { logger } from 'like-express';

app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip(),
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });
  next();
});
```

---

## Security Checklist

Before deploying to production:

- [ ] `maxBodySize` configured (≤ 10MB for most apps)
- [ ] `requestTimeout` set (30s - 2min)
- [ ] `trustProxy: true` ONLY behind actual proxy
- [ ] Rate limiting enabled (use Redis in production)
- [ ] CORS configured with specific origins
- [ ] HTTPS/TLS enabled with valid certificates
- [ ] File upload limits configured
- [ ] File type validation implemented
- [ ] Input validation with Zod schemas
- [ ] `debug: false` in production
- [ ] Error handler doesn't leak sensitive info
- [ ] Helmet middleware enabled
- [ ] All dependencies updated
- [ ] Security headers configured

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)

---

## Reporting Security Vulnerabilities

If you discover a security vulnerability in LikeExpress, please email security@example.com (replace with actual contact).

**Do NOT open a public issue.**
