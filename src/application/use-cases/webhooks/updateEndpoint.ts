import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookEndpointPublic, toPublicEndpoint } from '../../../domain/entities/Webhook.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';
import { UpdateWebhookInput } from '../../dtos/webhook.dto.js';

export class UpdateWebhookEndpointUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string, endpointId: string, input: UpdateWebhookInput): Promise<WebhookEndpointPublic> {
    const endpoint = await this.webhookRepo.findEndpointById(endpointId);
    if (!endpoint) throw new NotFoundError('WebhookEndpoint');
    if (endpoint.userId !== userId) throw new ForbiddenError();

    const updated = await this.webhookRepo.updateEndpoint(endpointId, {
      ...(input.url !== undefined && { url: input.url }),
      ...(input.events !== undefined && { events: input.events }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });

    return toPublicEndpoint(updated);
  }
}
