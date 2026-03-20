import { PrismaClient } from '@prisma/client';
import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';
import { TotpSecret } from '../../../domain/entities/TotpSecret.js';

export class PrismaTotpRepository implements ITotpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<TotpSecret | null> {
    const row = await this.prisma.totpSecret.findUnique({ where: { userId } });
    return row ? this.toDomain(row) : null;
  }

  async upsert(userId: string, secret: string): Promise<TotpSecret> {
    const row = await this.prisma.totpSecret.upsert({
      where: { userId },
      create: { userId, secret },
      update: { secret, isEnabled: false, backupCodes: [], enabledAt: null },
    });
    return this.toDomain(row);
  }

  async enable(userId: string, hashedBackupCodes: string[]): Promise<TotpSecret> {
    const row = await this.prisma.totpSecret.update({
      where: { userId },
      data: { isEnabled: true, backupCodes: hashedBackupCodes, enabledAt: new Date() },
    });
    return this.toDomain(row);
  }

  async consumeBackupCode(userId: string, hashedCode: string): Promise<boolean> {
    const row = await this.prisma.totpSecret.findUnique({ where: { userId } });
    if (!row || !row.isEnabled) return false;

    const codes = Array.isArray(row.backupCodes) ? (row.backupCodes as string[]) : [];
    const idx = codes.indexOf(hashedCode);
    if (idx === -1) return false;

    const updated = codes.filter((_, i) => i !== idx);
    await this.prisma.totpSecret.update({
      where: { userId },
      data: { backupCodes: updated },
    });
    return true;
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.totpSecret.delete({ where: { userId } }).catch(() => {/* already deleted */});
  }

  private toDomain(row: {
    id: string;
    userId: string;
    secret: string;
    isEnabled: boolean;
    backupCodes: unknown;
    enabledAt: Date | null;
    createdAt: Date;
  }): TotpSecret {
    return {
      id: row.id,
      userId: row.userId,
      secret: row.secret,
      isEnabled: row.isEnabled,
      backupCodes: Array.isArray(row.backupCodes) ? (row.backupCodes as string[]) : [],
      enabledAt: row.enabledAt,
      createdAt: row.createdAt,
    };
  }
}
