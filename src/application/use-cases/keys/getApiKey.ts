import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { toPublicApiKey, ApiKeyPublic } from '../../../domain/entities/ApiKey.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';

export class GetApiKeyUseCase {
  constructor(private readonly apiKeyRepo: IApiKeyRepository) {}

  async execute(userId: string, keyId: string): Promise<ApiKeyPublic> {
    const key = await this.apiKeyRepo.findById(keyId);
    if (!key) throw new NotFoundError('API key');
    // Users may only inspect their own keys
    if (key.userId !== userId) throw new ForbiddenError();
    return toPublicApiKey(key);
  }
}
