import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginUseCase } from '../../../src/application/use-cases/auth/login.js';
import { InvalidCredentialsError, UnauthorizedError } from '../../../src/domain/errors/index.js';
import type { IUserRepository } from '../../../src/domain/repositories/IUserRepository.js';
import type { IAuditLogRepository } from '../../../src/domain/repositories/IAuditLogRepository.js';
import type { AuthService } from '../../../src/application/services/AuthService.js';
import type { User } from '../../../src/domain/entities/User.js';

// Real bcrypt hash of "Password123!" — pre-computed so tests are fast
const VALID_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iuSK';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_001',
    email: 'alice@example.com',
    passwordHash: VALID_HASH,
    role: 'USER',
    isActive: true,
    emailVerified: true,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LoginUseCase', () => {
  let userRepo: IUserRepository;
  let authService: AuthService;
  let auditRepo: IAuditLogRepository;
  let loginUseCase: LoginUseCase;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    authService = {
      issueTokenPair: vi.fn().mockResolvedValue({
        accessToken: 'access.token.here',
        refreshToken: 'refresh-token-here',
        refreshCookie: 'session-id-here.refresh-token-here',
        sessionId: 'session-id-here',
        accessExpiresIn: 900,
      }),
      verifyAccessToken: vi.fn(),
      revokeAccessToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
      revokeSession: vi.fn(),
      verifyRefreshToken: vi.fn(),
      parseRefreshCookie: vi.fn(),
      listSessions: vi.fn(),
    } as unknown as AuthService;

    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
      findByUserId: vi.fn(),
    };

    loginUseCase = new LoginUseCase(userRepo, authService, auditRepo);
  });

  it('throws InvalidCredentialsError when user does not exist', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(null);

    await expect(
      loginUseCase.execute({ email: 'unknown@example.com', password: 'Password123!' }, {}),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws UnauthorizedError when account is inactive', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ isActive: false }));

    await expect(
      loginUseCase.execute({ email: 'alice@example.com', password: 'Password123!' }, {}),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws InvalidCredentialsError on wrong password', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

    await expect(
      loginUseCase.execute({ email: 'alice@example.com', password: 'WrongPassword!' }, {}),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('writes a failed audit log on bad password', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

    await expect(
      loginUseCase.execute({ email: 'alice@example.com', password: 'WrongPassword!' }, {
        ipAddress: '1.2.3.4',
      }),
    ).rejects.toThrow(InvalidCredentialsError);

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_LOGIN',
        metadata: expect.objectContaining({ success: false }),
      }),
    );
  });

  it('returns token pair and user on successful login', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

    // Override hash with a real bcrypt hash matching the test password
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Password123!', 4); // low rounds for speed in tests
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ passwordHash: hash }));

    const result = await loginUseCase.execute(
      { email: 'alice@example.com', password: 'Password123!' },
      { ipAddress: '127.0.0.1' },
    );

    expect(result.accessToken).toBe('access.token.here');
    expect(result.user.email).toBe('alice@example.com');
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_LOGIN',
        metadata: expect.objectContaining({ success: true }),
      }),
    );
  });
});
