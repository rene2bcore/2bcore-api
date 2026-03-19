import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookDelivery } from '../../../domain/entities/Webhook.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';

export class ListWebhookDeliveriesUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string, endpointId: string, limit = 50): Promise<WebhookDelivery[]> {
    const endpoint = await this.webhookRepo.findEndpointById(endpointId);
    if (!endpoint) throw new NotFoundError('WebhookEndpoint');
    if (endpoint.userId !== userId) throw new ForbiddenError();

    return this.webhookRepo.findDeliveriesByEndpointId(endpointId, limit);
  }
}
