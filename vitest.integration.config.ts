import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/unit/**'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    teardownTimeout: 10_000,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    sequence: { concurrent: false },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://2bcore:secret@localhost:5432/2bcore_db',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_PRIVATE_KEY_PATH: './keys/private.pem',
      JWT_PUBLIC_KEY_PATH: './keys/public.pem',
      JWT_ACCESS_TOKEN_EXPIRY: '15m',
      JWT_REFRESH_TOKEN_EXPIRY: '7d',
      JWT_ISSUER: '2bcore-api-test',
      JWT_AUDIENCE: '2bcore-clients-test',
      BCRYPT_ROUNDS: '10',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3001',
      RATE_LIMIT_GLOBAL_MAX: '1000',
      RATE_LIMIT_AUTH_MAX: '1000',
      RATE_LIMIT_GLOBAL_WINDOW_MS: '60000',
      RATE_LIMIT_AUTH_WINDOW_MS: '900000',
      RATE_LIMIT_AI_MAX: '1000',
      RATE_LIMIT_AI_WINDOW_MS: '60000',
      ANTHROPIC_API_KEY: 'sk-ant-test-integration',
      APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@application': resolve(__dirname, 'src/application'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@interfaces': resolve(__dirname, 'src/interfaces'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
