import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';
import { generateApiKey } from '../../../shared/utils/crypto.js';
import { env } from '../../../shared/config/env.js';
import type { IWebhookService } from '../../../domain/services/IWebhookService.js';
import { WEBHOOK_EVENTS } from '../../../shared/constants/index.js';

export interface RotateApiKeyOutput {
  id: string;
  name: string;
  key: string;    // raw key — returned once, caller must store
  prefix: string;
  scopes: string[];
  createdAt: string;
}

export class RotateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepo: IApiKeyRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly webhookService?: IWebhookService,
  ) {}

  async execute(userId: string, keyId: string): Promise<RotateApiKeyOutput> {
    const existing = await this.apiKeyRepo.findById(keyId);
    if (!existing) throw new NotFoundError('ApiKey');
    if (existing.userId !== userId) throw new ForbiddenError();

    const { raw, hashed } = generateApiKey(env.API_KEY_PREFIX);
    const prefix = raw.substring(0, 16) + '…';

    const rotated = await this.apiKeyRepo.rotate(keyId, { keyHash: hashed, prefix });

    await this.auditRepo.create({
      userId,
      action: 'API_KEY_CREATED',
      resourceType: 'ApiKey',
      resourceId: keyId,
      metadata: { name: rotated.name, scopes: rotated.scopes, rotated: true },
    });

    this.webhookService?.emit(userId, WEBHOOK_EVENTS.KEY_CREATED, {
      id: keyId,
      name: rotated.name,
      prefix,
      scopes: rotated.scopes,
      rotated: true,
    });

    return {
      id: rotated.id,
      name: rotated.name,
      key: raw,
      prefix,
      scopes: rotated.scopes,
      createdAt: rotated.createdAt.toISOString(),
    };
  }
}
