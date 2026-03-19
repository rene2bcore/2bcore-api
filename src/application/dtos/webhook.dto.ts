import { z } from 'zod';
import { ALL_WEBHOOK_EVENTS } from '../../shared/constants/index.js';

export const CreateWebhookInputSchema = z.object({
  url: z.string().url().max(2048),
  events: z
    .array(z.enum(ALL_WEBHOOK_EVENTS as [string, ...string[]]))
    .optional()
    .default([])
    .describe('Events to subscribe to. Empty array = all events (wildcard).'),
});

export const UpdateWebhookInputSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(ALL_WEBHOOK_EVENTS as [string, ...string[]])).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type CreateWebhookInput = z.infer<typeof CreateWebhookInputSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookInputSchema>;
