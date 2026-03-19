import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IWebhookService } from '../../domain/services/IWebhookService.js';
import { IWebhookRepository } from '../../domain/repositories/IWebhookRepository.js';
import { logger } from '../observability/logger.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 5_000, 30_000];
const DELIVERY_TIMEOUT_MS = 10_000;

interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export class WebhookDeliveryService implements IWebhookService {
  constructor(private readonly webhookRepo: IWebhookRepository) {}

  /**
   * Fire-and-forget: find matching endpoints and schedule deliveries.
   * Never throws — all errors are caught and logged.
   */
  emit(userId: string, event: string, data: Record<string, unknown>): void {
    void this.dispatchAsync(userId, event, data).catch((err) => {
      logger.error({ err, userId, event }, 'Unexpected error in webhook dispatch');
    });
  }

  private async dispatchAsync(userId: string, event: string, data: Record<string, unknown>): Promise<void> {
    const endpoints = await this.webhookRepo.findActiveEndpointsForEvent(userId, event);
    if (endpoints.length === 0) return;

    const payload: WebhookPayload = {
      id: `evt_${uuidv4().replace(/-/g, '')}`,
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const endpoint of endpoints) {
      // Schedule each endpoint delivery independently
      void this.deliverWithRetry(endpoint.id, endpoint.url, endpoint.secret, payload);
    }
  }

  private async deliverWithRetry(
    endpointId: string,
    url: string,
    secret: string,
    payload: WebhookPayload,
  ): Promise<void> {
    const body = JSON.stringify(payload);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 0;
      if (delay > 0) await sleep(delay);

      const { statusCode, responseBody, success } = await this.deliver(url, secret, body, payload.timestamp);

      await this.webhookRepo.createDelivery({
        endpointId,
        eventType: payload.event,
        payload: payload as unknown as Record<string, unknown>,
        ...(statusCode !== null && { statusCode }),
        ...(responseBody !== null && { responseBody }),
        attempt,
        success,
      }).catch((err) => {
        logger.warn({ err, endpointId }, 'Failed to log webhook delivery');
      });

      if (success) return;

      logger.warn({ endpointId, url, attempt, statusCode }, 'Webhook delivery failed, will retry if attempts remain');
    }

    logger.error({ endpointId, url }, 'Webhook delivery exhausted all attempts');
  }

  private async deliver(
    url: string,
    secret: string,
    body: string,
    timestamp: string,
  ): Promise<{ statusCode: number | null; responseBody: string | null; success: boolean }> {
    const signature = this.sign(secret, timestamp, body);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Timestamp': timestamp,
            'User-Agent': '2bcore-webhooks/1.0',
          },
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const responseBody = await response.text().catch(() => null);
      const success = response.status >= 200 && response.status < 300;

      return { statusCode: response.status, responseBody: responseBody?.slice(0, 1000) ?? null, success };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { statusCode: null, responseBody: message.slice(0, 1000), success: false };
    }
  }

  /** HMAC-SHA256 signature: hex(HMAC(secret, "<timestamp>.<body>")) */
  private sign(secret: string, timestamp: string, body: string): string {
    return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
