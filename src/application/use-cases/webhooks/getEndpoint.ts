import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookEndpointPublic, toPublicEndpoint } from '../../../domain/entities/Webhook.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';

export class GetWebhookEndpointUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string, endpointId: string): Promise<WebhookEndpointPublic> {
    const endpoint = await this.webhookRepo.findEndpointById(endpointId);
    if (!endpoint) throw new NotFoundError('WebhookEndpoint');
    if (endpoint.userId !== userId) throw new ForbiddenError();
    return toPublicEndpoint(endpoint);
  }
}
