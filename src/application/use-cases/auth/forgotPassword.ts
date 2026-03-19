import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IPasswordResetRepository } from '../../../domain/repositories/IPasswordResetRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { IEmailService } from '../../../domain/services/IEmailService.js';
import { sha256, randomHex } from '../../../shared/utils/crypto.js';
import { env } from '../../../shared/config/env.js';

export interface ForgotPasswordContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordResetRepo: IPasswordResetRepository,
    private readonly emailService: IEmailService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(email: string, ctx: ForgotPasswordContext): Promise<void> {
    // Always return success to prevent email enumeration
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.isActive) return;

    // Invalidate any existing pending reset tokens
    await this.passwordResetRepo.deleteByUserId(user.id);

    const rawToken = randomHex(32);
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.passwordResetRepo.create({ userId: user.id, tokenHash, expiresAt });

    const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;

    await this.emailService.send({
      to: user.email,
      subject: 'Reset your password — 2BCORE',
      text: `Click the link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.`,
      html: `
        <p>You requested a password reset.</p>
        <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      `.trim(),
    });

    await this.auditRepo.create({
      userId: user.id,
      action: 'USER_PASSWORD_RESET_REQUESTED',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: user.email },
    });
  }
}
