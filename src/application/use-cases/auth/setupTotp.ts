import { generateSecret, generateURI } from 'otplib';
import qrcode from 'qrcode';
import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';
import { env } from '../../../shared/config/env.js';

export interface SetupTotpOutput {
  secret: string;        // base32 secret for manual entry
  otpauthUrl: string;    // otpauth:// URI for authenticator apps
  qrDataUrl: string;     // data:image/png;base64,... for QR display
}

export class SetupTotpUseCase {
  constructor(private readonly totpRepo: ITotpRepository) {}

  async execute(userId: string, email: string): Promise<SetupTotpOutput> {
    const secret = generateSecret();
    await this.totpRepo.upsert(userId, secret);

    const issuer = env.JWT_ISSUER;
    const otpauthUrl = generateURI({ issuer, label: email, secret });
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrDataUrl };
  }
}
