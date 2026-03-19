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

export const VerifyEmailInputSchema = z.object({
  token: z.string().min(1),
});

export const ResendVerificationInputSchema = z.object({
  email: z.string().email(),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type LoginOutput = z.infer<typeof LoginOutputSchema>;
export type RefreshOutput = z.infer<typeof RefreshOutputSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailInputSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationInputSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
