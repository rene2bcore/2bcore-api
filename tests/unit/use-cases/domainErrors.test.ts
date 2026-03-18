import { describe, it, expect } from 'vitest';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InvalidCredentialsError,
  TokenExpiredError,
  TokenRevokedError,
  ApiKeyInvalidError,
  ValidationError,
} from '../../../src/domain/errors/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../../src/shared/constants/index.js';

describe('Domain Errors', () => {
  it('UnauthorizedError has correct statusCode and code', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(err instanceof Error).toBe(true);
  });

  it('ForbiddenError has 403 statusCode', () => {
    expect(new ForbiddenError().statusCode).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it('NotFoundError includes resource name', () => {
    const err = new NotFoundError('User');
    expect(err.message).toContain('User');
    expect(err.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
  });

  it('InvalidCredentialsError uses AUTH_001 code', () => {
    expect(new InvalidCredentialsError().code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('TokenExpiredError uses AUTH_002 code', () => {
    expect(new TokenExpiredError().code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });

  it('TokenRevokedError uses AUTH_004 code', () => {
    expect(new TokenRevokedError().code).toBe(ERROR_CODES.TOKEN_REVOKED);
  });

  it('ApiKeyInvalidError uses KEY_001 code', () => {
    expect(new ApiKeyInvalidError().code).toBe(ERROR_CODES.API_KEY_INVALID);
  });

  it('ValidationError stores details', () => {
    const details = [{ field: 'email', issue: 'Invalid' }];
    const err = new ValidationError('Bad input', details);
    expect(err.details).toEqual(details);
    expect(err.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE);
  });
});
