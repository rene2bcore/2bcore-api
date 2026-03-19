import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendVerificationEmailUseCase } from '../../../../src/application/use-cases/auth/sendVerificationEmail.js';
import type { IUserRepository } from '../../../../src/domain/repositories/IUserRepository.js';
import type { IEmailVerificationRepository } from '../../../../src/domain/repositories/IEmailVerificationRepository.js';
import type { IEmailService } from '../../../../src/domain/services/IEmailService.js';
import { NotFoundError } from '../../../../src/domain/errors/index.js';

const baseUser = {
  id: 'usr_001',
  email: 'alice@example.com',
  passwordHash: 'hash',
  role: 'USER' as const,
  isActive: true,
  emailVerified: false,
  emailVerifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeUserRepo(overrides?: Partial<IUserRepository>): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(baseUser),
    findByEmail: vi.fn().mockResolvedValue(baseUser),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as IUserRepository;
}

function makeEmailVerificationRepo(): IEmailVerificationRepository {
  return {
    create: vi.fn().mockResolvedValue({}),
    findByTokenHash: vi.fn(),
    markUsed: vi.fn(),
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEmailService(): IEmailService {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

describe('SendVerificationEmailUseCase', () => {
  let userRepo: IUserRepository;
  let emailVerificationRepo: IEmailVerificationRepository;
  let emailService: IEmailService;
  let useCase: SendVerificationEmailUseCase;

  beforeEach(() => {
    userRepo = makeUserRepo();
    emailVerificationRepo = makeEmailVerificationRepo();
    emailService = makeEmailService();
    useCase = new SendVerificationEmailUseCase(userRepo, emailVerificationRepo, emailService);
  });

  it('sends verification email for unverified user', async () => {
    await useCase.execute('usr_001');
    expect(emailVerificationRepo.deleteByUserId).toHaveBeenCalledWith('usr_001');
    expect(emailVerificationRepo.create).toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@example.com' }),
    );
  });

  it('is a no-op if user is already verified', async () => {
    userRepo = makeUserRepo({ findById: vi.fn().mockResolvedValue({ ...baseUser, emailVerified: true }) });
    useCase = new SendVerificationEmailUseCase(userRepo, emailVerificationRepo, emailService);
    await useCase.execute('usr_001');
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('throws NotFoundError if user does not exist', async () => {
    userRepo = makeUserRepo({ findById: vi.fn().mockResolvedValue(null) });
    useCase = new SendVerificationEmailUseCase(userRepo, emailVerificationRepo, emailService);
    await expect(useCase.execute('bad')).rejects.toThrow(NotFoundError);
  });

  describe('executeByEmail', () => {
    it('sends email when user exists and is unverified', async () => {
      await useCase.executeByEmail('alice@example.com');
      expect(emailService.send).toHaveBeenCalled();
    });

    it('is a no-op when user does not exist', async () => {
      userRepo = makeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
      useCase = new SendVerificationEmailUseCase(userRepo, emailVerificationRepo, emailService);
      await expect(useCase.executeByEmail('unknown@example.com')).resolves.toBeUndefined();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('is a no-op when user is already verified', async () => {
      userRepo = makeUserRepo({ findByEmail: vi.fn().mockResolvedValue({ ...baseUser, emailVerified: true }) });
      useCase = new SendVerificationEmailUseCase(userRepo, emailVerificationRepo, emailService);
      await expect(useCase.executeByEmail('alice@example.com')).resolves.toBeUndefined();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('is a no-op when user is inactive', async () => {
      userRepo = makeUserRepo({ findByEmail: vi.fn().mockResolvedValue({ ...baseUser, isActive: false }) });
      useCase = new SendVerificationEmailUseCase(userRepo, emailVerificationRepo, emailService);
      await expect(useCase.executeByEmail('alice@example.com')).resolves.toBeUndefined();
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });
});
