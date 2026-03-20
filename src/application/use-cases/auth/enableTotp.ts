import { verify } from 'otplib';
import bcrypt from 'bcryptjs';
import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { NotFoundError, TotpAlreadyEnabledError, TotpInvalidCodeError } from '../../../domain/errors/index.js';
import { randomHex } from '../../../shared/utils/crypto.js';

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 5; // 10-char hex codes

export interface EnableTotpOutput {
  backupCodes: string[]; // plaintext, shown once — store securely
}

export class EnableTotpUseCase {
  constructor(
    private readonly totpRepo: ITotpRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(userId: string, code: string): Promise<EnableTotpOutput> {
    const totp = await this.totpRepo.findByUserId(userId);
    if (!totp) throw new NotFoundError('TOTP setup');
    if (totp.isEnabled) throw new TotpAlreadyEnabledError();

    const result = await verify({ token: code, secret: totp.secret });
    if (!result.valid) throw new TotpInvalidCodeError();

    // Generate backup codes: plaintext for display, hashed for storage
    const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => randomHex(BACKUP_CODE_BYTES));
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

    await this.totpRepo.enable(userId, hashedCodes);

    await this.auditRepo.create({
      userId,
      action: 'TOTP_ENABLED',
      resourceType: 'totp',
      resourceId: userId,
    });

    return { backupCodes: plainCodes };
  }
}
