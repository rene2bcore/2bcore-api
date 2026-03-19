import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { generateApiKey } from '../../../shared/utils/crypto.js';
import { env } from '../../../shared/config/env.js';
import { CreateApiKeyInput, CreateApiKeyOutput } from '../../dtos/apikey.dto.js';

export class CreateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepo: IApiKeyRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(userId: string, input: CreateApiKeyInput): Promise<CreateApiKeyOutput> {
    const { raw, hashed } = generateApiKey(env.API_KEY_PREFIX);
    // Store the first 16 chars as a display prefix hint (safe to show)
    const prefix = raw.substring(0, 16) + '…';

    const apiKey = await this.apiKeyRepo.create({
      userId,
      name: input.name,
      keyHash: hashed,
      prefix,
      scopes: input.scopes,
    });

    await this.auditRepo.create({
      userId,
      action: 'API_KEY_CREATED',
      resourceType: 'ApiKey',
      resourceId: apiKey.id,
      metadata: { name: input.name, scopes: apiKey.scopes },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: raw, // Returned ONCE — caller must store it
      prefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt.toISOString(),
    };
  }
}
