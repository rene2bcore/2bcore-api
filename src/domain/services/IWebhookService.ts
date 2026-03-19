/**
 * Port for the webhook delivery service.
 * emit() is fire-and-forget — callers should not await it.
 */
export interface IWebhookService {
  emit(userId: string, event: string, data: Record<string, unknown>): void;
}
