import { z } from 'zod';
import { ALL_SCOPES } from '../../shared/constants/index.js';

export const CreateApiKeyInputSchema = z.object({
  name: z.string().min(1).max(64).trim(),
  scopes: z
    .array(z.enum(ALL_SCOPES as [string, ...string[]]))
    .optional()
    .default([])
    .describe('Restrict key to specific scopes. Empty array = full access (wildcard).'),
  rateLimit: z.number().int().min(1).max(10000).optional(),
});

export const CreateApiKeyOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(), // raw key — returned ONCE only
  prefix: z.string(),
  scopes: z.array(z.string()),
  createdAt: z.string(),
});

export const ApiKeyMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInputSchema>;
export type CreateApiKeyOutput = z.infer<typeof CreateApiKeyOutputSchema>;
export type ApiKeyMetadata = z.infer<typeof ApiKeyMetadataSchema>;
