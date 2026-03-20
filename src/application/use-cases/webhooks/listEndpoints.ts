import { IWebhookRepository } from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookEndpointPublic, toPublicEndpoint } from '../../../domain/entities/Webhook.js';

export interface ListWebhookEndpointsQuery {
  page: number;
  limit: number;
}

export interface WebhookEndpointPublicPage {
  data: WebhookEndpointPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListWebhookEndpointsUseCase {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  async execute(userId: string, query: ListWebhookEndpointsQuery): Promise<WebhookEndpointPublicPage> {
    const { page, limit } = query;
    const { data, total } = await this.webhookRepo.findEndpointsByUserIdPaged(userId, { page, limit });
    return {
      data: data.map(toPublicEndpoint),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
