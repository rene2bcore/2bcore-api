import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';
import { randomHex } from '../../../shared/utils/crypto.js';
import type { IWebhookService } from '../../../domain/services/IWebhookService.js';
import { WEBHOOK_EVENTS } from '../../../shared/constants/index.js';
import { WebhookEndpointPublic, toPublicEndpoint } from '../../../domain/entities/Webhook.js';

export interface RotateWebhookSecretOutput extends WebhookEndpointPublic {
  secret: string; // returned once — caller must store
}

export class RotateWebhookSecretUseCase {
  constructor(
    private readonly webhookRepo: IWebhookRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly webhookService?: IWebhookService,
  ) {}

  async execute(userId: string, endpointId: string): Promise<RotateWebhookSecretOutput> {
    const endpoint = await this.webhookRepo.findEndpointById(endpointId);
    if (!endpoint) throw new NotFoundError('WebhookEndpoint');
    if (endpoint.userId !== userId) throw new ForbiddenError();

    const secret = randomHex(32); // 64-char hex

    const updated = await this.webhookRepo.updateEndpoint(endpointId, { secret });

    await this.auditRepo.create({
      userId,
      action: 'API_KEY_CREATED', // closest available action for a secret rotation
      resourceType: 'WebhookEndpoint',
      resourceId: endpointId,
      metadata: { rotated: true, url: updated.url },
    });

    this.webhookService?.emit(userId, WEBHOOK_EVENTS.KEY_CREATED, {
      id: endpointId,
      url: updated.url,
      rotated: true,
    });

    return { ...toPublicEndpoint(updated), secret };
  }
}
