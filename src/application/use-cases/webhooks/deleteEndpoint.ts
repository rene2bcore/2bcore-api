import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { NotFoundError, ForbiddenError } from '../../../domain/errors/index.js';

export class DeleteWebhookEndpointUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string, endpointId: string): Promise<void> {
    const endpoint = await this.webhookRepo.findEndpointById(endpointId);
    if (!endpoint) throw new NotFoundError('WebhookEndpoint');
    if (endpoint.userId !== userId) throw new ForbiddenError();
    await this.webhookRepo.deleteEndpoint(endpointId);
  }
}
