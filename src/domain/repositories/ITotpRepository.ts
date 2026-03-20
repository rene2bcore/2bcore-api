import { TotpSecret } from '../entities/TotpSecret.js';

export interface ITotpRepository {
  findByUserId(userId: string): Promise<TotpSecret | null>;
  upsert(userId: string, secret: string): Promise<TotpSecret>;
  enable(userId: string, hashedBackupCodes: string[]): Promise<TotpSecret>;
  consumeBackupCode(userId: string, hashedCode: string): Promise<boolean>;
  delete(userId: string): Promise<void>;
}
