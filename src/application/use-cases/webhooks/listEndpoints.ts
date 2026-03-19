import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookEndpointPublic, toPublicEndpoint } from '../../../domain/entities/Webhook.js';

export class ListWebhookEndpointsUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string): Promise<WebhookEndpointPublic[]> {
    const endpoints = await this.webhookRepo.findEndpointsByUserId(userId);
    return endpoints.map(toPublicEndpoint);
  }
}
