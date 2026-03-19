export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  secret: string; // raw secret — used server-side for HMAC signing only
  events: string[]; // empty = subscribe to all (wildcard)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEndpointPublic {
  id: string;
  userId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseBody: string | null;
  attempt: number;
  success: boolean;
  createdAt: Date;
}

export function toPublicEndpoint(ep: WebhookEndpoint): WebhookEndpointPublic {
  return {
    id: ep.id,
    userId: ep.userId,
    url: ep.url,
    events: ep.events,
    isActive: ep.isActive,
    createdAt: ep.createdAt,
    updatedAt: ep.updatedAt,
  };
}
