import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // JWT
  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  JWT_ISSUER: z.string().default('2bcore-api'),
  JWT_AUDIENCE: z.string().default('2bcore-clients'),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  API_KEY_PREFIX: z.string().default('sk-live-'),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3001'),

  // Rate limiting
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_AI_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AI_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // OpenTelemetry
  OTEL_SERVICE_NAME: z.string().default('2bcore-api'),
  OTEL_SERVICE_VERSION: z.string().default('1.0.0'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_METRICS_PORT: z.coerce.number().int().positive().default(9090),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1),
  AI_MONTHLY_TOKEN_BUDGET: z.coerce.number().int().min(0).default(0), // 0 = unlimited
  AI_DEFAULT_MAX_TOKENS: z.coerce.number().int().min(1).max(8192).default(1024),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  [${i.path.join('.')}] ${i.message}`)
      .join('\n');
    // Fail fast — invalid config means the process must not start
    console.error(`[Config] Environment validation failed:\n${formatted}`);
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
