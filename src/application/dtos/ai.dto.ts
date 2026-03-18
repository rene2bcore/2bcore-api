import { z } from 'zod';

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(100_000),
});

export const ChatInputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(100),
  system: z.string().max(10_000).optional(),
  model: z.string().optional(), // tier name ('fast'|'standard'|'powerful') or exact model ID
  maxTokens: z.coerce.number().int().min(1).max(8192).optional(),
  stream: z.boolean().default(false),
});

export const ChatOutputSchema = z.object({
  id: z.string(),
  model: z.string(),
  content: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    estimatedCostUsd: z.number(),
  }),
});

export type Message = z.infer<typeof MessageSchema>;
export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
export type ChatUsage = ChatOutput['usage'];
