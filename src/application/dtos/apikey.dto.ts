import { z } from 'zod';

export const CreateApiKeyInputSchema = z.object({
  name: z.string().min(1).max(64).trim(),
});

export const CreateApiKeyOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(), // raw key — returned ONCE only
  prefix: z.string(),
  createdAt: z.string(),
});

export const ApiKeyMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  isActive: z.boolean(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInputSchema>;
export type CreateApiKeyOutput = z.infer<typeof CreateApiKeyOutputSchema>;
export type ApiKeyMetadata = z.infer<typeof ApiKeyMetadataSchema>;
