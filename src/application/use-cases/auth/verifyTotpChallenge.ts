import { verify } from 'otplib';
import bcrypt from 'bcryptjs';
import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService, TokenPair } from '../../services/AuthService.js';
import { TotpInvalidCodeError, TotpNotEnabledError } from '../../../domain/errors/index.js';

export interface TotpChallengeContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface TotpChallengeInput {
  challengeToken: string;
  code: string;
}

export class VerifyTotpChallengeUseCase {
  constructor(
    private readonly totpRepo: ITotpRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(input: TotpChallengeInput, ctx: TotpChallengeContext): Promise<TokenPair & { user: { id: string; email: string; role: string } }> {
    const { sub: userId, email, role } = this.authService.verifyChallengeToken(input.challengeToken);

    const totp = await this.totpRepo.findByUserId(userId);
    if (!totp || !totp.isEnabled) throw new TotpNotEnabledError();

    const result = await verify({ token: input.code, secret: totp.secret });
    if (!result.valid) {
      // Try backup codes
      const consumed = await this.tryBackupCode(userId, input.code, totp.backupCodes);
      if (!consumed) {
        await this.auditRepo.create({
          userId,
          action: 'TOTP_CHALLENGE_FAILED',
          resourceType: 'totp',
          resourceId: userId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
        throw new TotpInvalidCodeError();
      }
    }

    const tokenPair = await this.authService.issueTokenPair(userId, email, role, {
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    });

    await this.auditRepo.create({
      userId,
      action: 'USER_LOGIN',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { success: true, sessionId: tokenPair.sessionId, via: '2fa' },
    });

    return { ...tokenPair, user: { id: userId, email, role } };
  }

  private async tryBackupCode(userId: string, code: string, hashedCodes: string[]): Promise<boolean> {
    for (const hash of hashedCodes) {
      const match = await bcrypt.compare(code, hash);
      if (match) {
        await this.totpRepo.consumeBackupCode(userId, hash);
        return true;
      }
    }
    return false;
  }
}
