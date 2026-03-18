import pino from 'pino';
import { env } from '../../shared/config/env.js';

/**
 * Paths to redact from all log output.
 * Prevents passwords, tokens, and secrets from leaking into logs.
 */
const REDACT_PATHS = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  '*.password',
  '*.passwordHash',
  'body.password',
  'body.currentPassword',
  'body.newPassword',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'accessToken',
  'refreshToken',
  'token',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  'key',
  '*.key',
  'keyHash',
  'secret',
  '*.secret',
];

const baseOptions = {
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
};

export const logger = env.LOG_PRETTY
  ? pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    })
  : pino(baseOptions);

export type Logger = typeof logger;
