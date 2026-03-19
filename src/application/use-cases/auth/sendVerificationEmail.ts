import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IEmailVerificationRepository } from '../../../domain/repositories/IEmailVerificationRepository.js';
import { IEmailService } from '../../../domain/services/IEmailService.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import { sha256, randomHex } from '../../../shared/utils/crypto.js';
import { env } from '../../../shared/config/env.js';

export class SendVerificationEmailUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailVerificationRepo: IEmailVerificationRepository,
    private readonly emailService: IEmailService,
  ) {}

  /**
   * Send by email — silent no-op if user not found or already verified.
   * Used by the resend-verification endpoint to prevent email enumeration.
   */
  async executeByEmail(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.isActive || user.emailVerified) return;
    await this.execute(user.id);
  }

  /** Send by userId — throws NotFoundError if user does not exist. */
  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.emailVerified) return; // already verified — no-op

    // Invalidate any existing pending tokens for this user
    await this.emailVerificationRepo.deleteByUserId(userId);

    const rawToken = randomHex(32); // 64-char hex string
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.emailVerificationRepo.create({ userId, tokenHash, expiresAt });

    const verificationUrl = `${env.APP_URL}/v1/auth/verify-email?token=${rawToken}`;

    await this.emailService.send({
      to: user.email,
      subject: 'Verify your email address — 2BCORE',
      text: `Click the link to verify your email: ${verificationUrl}\n\nThis link expires in 24 hours. If you did not create an account, you can safely ignore this email.`,
      html: `
        <p>Welcome to 2BCORE!</p>
        <p>Click <a href="${verificationUrl}">here</a> to verify your email address.</p>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <p>If you did not create an account, you can safely ignore this email.</p>
      `.trim(),
    });
  }
}
