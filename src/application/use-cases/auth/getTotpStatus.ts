import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';

export interface TotpStatusOutput {
  isEnabled: boolean;
  enabledAt: string | null;
}

export class GetTotpStatusUseCase {
  constructor(private readonly totpRepo: ITotpRepository) {}

  async execute(userId: string): Promise<TotpStatusOutput> {
    const totp = await this.totpRepo.findByUserId(userId);
    return {
      isEnabled: totp?.isEnabled ?? false,
      enabledAt: totp?.enabledAt?.toISOString() ?? null,
    };
  }
}
