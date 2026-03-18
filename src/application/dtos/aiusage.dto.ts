import { z } from 'zod';

export const AiUsageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  to: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type AiUsageQuery = z.infer<typeof AiUsageQuerySchema>;
