import { ERROR_CODES, HTTP_STATUS } from '../../shared/constants/index.js';

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized', code: string = ERROR_CODES.TOKEN_INVALID) {
    super(message, code, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, ERROR_CODES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} not found`, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT', HTTP_STATUS.CONFLICT);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE);
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
  }
}

export class TokenExpiredError extends UnauthorizedError {
  constructor() {
    super('Token has expired', ERROR_CODES.TOKEN_EXPIRED);
  }
}

export class TokenRevokedError extends UnauthorizedError {
  constructor() {
    super('Token has been revoked', ERROR_CODES.TOKEN_REVOKED);
  }
}

export class ApiKeyInvalidError extends UnauthorizedError {
  constructor() {
    super('Invalid API key', ERROR_CODES.API_KEY_INVALID);
  }
}

export class ApiKeyRevokedError extends UnauthorizedError {
  constructor() {
    super('API key has been revoked', ERROR_CODES.API_KEY_REVOKED);
  }
}
