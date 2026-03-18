import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const LoginOutputSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
  }),
});

export const RefreshOutputSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type LoginOutput = z.infer<typeof LoginOutputSchema>;
export type RefreshOutput = z.infer<typeof RefreshOutputSchema>;
