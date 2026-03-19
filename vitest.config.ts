import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_PRIVATE_KEY_PATH: './keys/private.pem',
      JWT_PUBLIC_KEY_PATH: './keys/public.pem',
      JWT_ACCESS_TOKEN_EXPIRY: '15m',
      JWT_REFRESH_TOKEN_EXPIRY: '7d',
      JWT_ISSUER: '2bcore-api-test',
      JWT_AUDIENCE: '2bcore-clients-test',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3001',
      ANTHROPIC_API_KEY: 'sk-ant-test-dummy-key-for-vitest',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'src/interfaces/http/server.ts',
        'src/infrastructure/observability/tracing.ts',
        'scripts/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
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
