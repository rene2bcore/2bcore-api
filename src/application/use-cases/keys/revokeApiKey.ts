import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';
import type { IWebhookService } from '../../../domain/services/IWebhookService.js';
import { WEBHOOK_EVENTS } from '../../../shared/constants/index.js';

export class RevokeApiKeyUseCase {
  constructor(
    private readonly apiKeyRepo: IApiKeyRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly webhookService?: IWebhookService,
  ) {}

  async execute(userId: string, keyId: string): Promise<void> {
    const key = await this.apiKeyRepo.findById(keyId);

    if (!key) throw new NotFoundError('ApiKey');
    if (key.userId !== userId) throw new ForbiddenError();

    await this.apiKeyRepo.revoke(keyId);

    await this.auditRepo.create({
      userId,
      action: 'API_KEY_REVOKED',
      resourceType: 'ApiKey',
      resourceId: keyId,
    });

    this.webhookService?.emit(userId, WEBHOOK_EVENTS.KEY_REVOKED, {
      id: keyId,
      name: key.name,
      prefix: key.prefix,
    });
  }
}
