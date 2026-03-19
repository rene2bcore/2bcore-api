import { PrismaClient } from '@prisma/client';
import {
  IWebhookRepository,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  CreateDeliveryInput,
} from '../../../domain/repositories/IWebhookRepository.js';
import { WebhookEndpoint, WebhookDelivery } from '../../../domain/entities/Webhook.js';

export class PrismaWebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findEndpointById(id: string): Promise<WebhookEndpoint | null> {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    return row ? this.toEndpointDomain(row) : null;
  }

  async findEndpointsByUserId(userId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEndpointDomain(r));
  }

  async findActiveEndpointsForEvent(userId: string, event: string): Promise<WebhookEndpoint[]> {
    // Fetch all active endpoints for user; filter by event subscription in memory
    // (JSON array queries vary across DBs — in-memory filter is portable and correct for typical webhook counts)
    const rows = await this.prisma.webhookEndpoint.findMany({
      where: { userId, isActive: true },
    });
    return rows
      .map((r) => this.toEndpointDomain(r))
      .filter((ep) => ep.events.length === 0 || ep.events.includes(event));
  }

  async createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        userId: input.userId,
        url: input.url,
        secret: input.secret,
        events: input.events ?? [],
      },
    });
    return this.toEndpointDomain(row);
  }

  async updateEndpoint(id: string, input: UpdateWebhookEndpointInput): Promise<WebhookEndpoint> {
    const row = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(input.url !== undefined && { url: input.url }),
        ...(input.events !== undefined && { events: input.events }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return this.toEndpointDomain(row);
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async createDelivery(input: CreateDeliveryInput): Promise<WebhookDelivery> {
    const row = await this.prisma.webhookDelivery.create({
      data: {
        endpointId: input.endpointId,
        eventType: input.eventType,
        payload: input.payload as object,
        statusCode: input.statusCode ?? null,
        responseBody: input.responseBody ?? null,
        attempt: input.attempt,
        success: input.success,
      },
    });
    return this.toDeliveryDomain(row);
  }

  async findDeliveriesByEndpointId(endpointId: string, limit = 50): Promise<WebhookDelivery[]> {
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => this.toDeliveryDomain(r));
  }

  private toEndpointDomain(row: {
    id: string;
    userId: string;
    url: string;
    secret: string;
    events: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookEndpoint {
    return {
      id: row.id,
      userId: row.userId,
      url: row.url,
      secret: row.secret,
      events: Array.isArray(row.events) ? (row.events as string[]) : [],
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toDeliveryDomain(row: {
    id: string;
    endpointId: string;
    eventType: string;
    payload: unknown;
    statusCode: number | null;
    responseBody: string | null;
    attempt: number;
    success: boolean;
    createdAt: Date;
  }): WebhookDelivery {
    return {
      id: row.id,
      endpointId: row.endpointId,
      eventType: row.eventType,
      payload: (row.payload as Record<string, unknown>) ?? {},
      statusCode: row.statusCode,
      responseBody: row.responseBody,
      attempt: row.attempt,
      success: row.success,
      createdAt: row.createdAt,
    };
  }
}
