import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { toPublicApiKey, ApiKeyPublic } from '../../../domain/entities/ApiKey.js';

export class ListApiKeysUseCase {
  constructor(private readonly apiKeyRepo: IApiKeyRepository) {}

  async execute(userId: string): Promise<ApiKeyPublic[]> {
    const keys = await this.apiKeyRepo.findByUserId(userId);
    return keys.map(toPublicApiKey);
  }
}
