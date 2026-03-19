import { WebhookEndpoint, WebhookDelivery } from '../entities/Webhook.js';

export interface CreateWebhookEndpointInput {
  userId: string;
  url: string;
  secret: string;
  events?: string[];
}

export interface UpdateWebhookEndpointInput {
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export interface CreateDeliveryInput {
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode?: number;
  responseBody?: string;
  attempt: number;
  success: boolean;
}

export interface IWebhookRepository {
  // Endpoints
  findEndpointById(id: string): Promise<WebhookEndpoint | null>;
  findEndpointsByUserId(userId: string): Promise<WebhookEndpoint[]>;
  findActiveEndpointsForEvent(userId: string, event: string): Promise<WebhookEndpoint[]>;
  createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint>;
  updateEndpoint(id: string, input: UpdateWebhookEndpointInput): Promise<WebhookEndpoint>;
  deleteEndpoint(id: string): Promise<void>;

  // Deliveries
  createDelivery(input: CreateDeliveryInput): Promise<WebhookDelivery>;
  findDeliveriesByEndpointId(endpointId: string, limit?: number): Promise<WebhookDelivery[]>;
}
