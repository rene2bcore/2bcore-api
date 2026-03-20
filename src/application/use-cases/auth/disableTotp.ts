import { verify } from 'otplib';
import bcrypt from 'bcryptjs';
import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { TotpNotEnabledError, TotpInvalidCodeError } from '../../../domain/errors/index.js';

export class DisableTotpUseCase {
  constructor(
    private readonly totpRepo: ITotpRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  /** Disable 2FA. Requires a valid TOTP code OR a backup code. */
  async execute(userId: string, code: string): Promise<void> {
    const totp = await this.totpRepo.findByUserId(userId);
    if (!totp || !totp.isEnabled) throw new TotpNotEnabledError();

    const result = await verify({ token: code, secret: totp.secret });
    if (!result.valid) {
      // Try backup codes
      const consumed = await this.tryBackupCode(userId, code, totp.backupCodes);
      if (!consumed) throw new TotpInvalidCodeError();
    }

    await this.totpRepo.delete(userId);

    await this.auditRepo.create({
      userId,
      action: 'TOTP_DISABLED',
      resourceType: 'totp',
      resourceId: userId,
    });
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
