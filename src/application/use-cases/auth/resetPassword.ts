import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IPasswordResetRepository } from '../../../domain/repositories/IPasswordResetRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../services/AuthService.js';
import { InvalidOrExpiredTokenError } from '../../../domain/errors/index.js';
import { sha256 } from '../../../shared/utils/crypto.js';
import { env } from '../../../shared/config/env.js';

export interface ResetPasswordContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordResetRepo: IPasswordResetRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(rawToken: string, newPassword: string, ctx: ResetPasswordContext): Promise<void> {
    const tokenHash = sha256(rawToken);
    const record = await this.passwordResetRepo.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new InvalidOrExpiredTokenError('Password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

    await this.passwordResetRepo.markUsed(record.id);
    await this.userRepo.update(record.userId, { passwordHash });

    // Revoke all sessions — password change invalidates all existing sessions
    await this.authService.revokeRefreshToken(record.userId);

    await this.auditRepo.create({
      userId: record.userId,
      action: 'USER_PASSWORD_RESET',
      resourceType: 'user',
      resourceId: record.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {},
    });
  }
}
