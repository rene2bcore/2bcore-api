import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IEmailVerificationRepository } from '../../../domain/repositories/IEmailVerificationRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { InvalidOrExpiredTokenError } from '../../../domain/errors/index.js';
import { sha256 } from '../../../shared/utils/crypto.js';

export interface VerifyEmailContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailVerificationRepo: IEmailVerificationRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(rawToken: string, ctx: VerifyEmailContext): Promise<void> {
    const tokenHash = sha256(rawToken);
    const record = await this.emailVerificationRepo.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new InvalidOrExpiredTokenError('Verification token');
    }

    await this.emailVerificationRepo.markUsed(record.id);
    await this.userRepo.update(record.userId, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await this.auditRepo.create({
      userId: record.userId,
      action: 'USER_EMAIL_VERIFIED',
      resourceType: 'user',
      resourceId: record.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {},
    });
  }
}
