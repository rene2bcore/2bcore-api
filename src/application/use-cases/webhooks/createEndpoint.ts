import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookEndpointPublic, toPublicEndpoint } from '../../../domain/entities/Webhook.js';
import { CreateWebhookInput } from '../../dtos/webhook.dto.js';
import { randomHex } from '../../../shared/utils/crypto.js';

export class CreateWebhookEndpointUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string, input: CreateWebhookInput): Promise<WebhookEndpointPublic & { secret: string }> {
    const secret = randomHex(32); // 64-char hex — returned once

    const endpoint = await this.webhookRepo.createEndpoint({
      userId,
      url: input.url,
      secret,
      events: input.events,
    });

    return { ...toPublicEndpoint(endpoint), secret };
  }
}
