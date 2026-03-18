import { z } from 'zod';

export const RegisterUserInputSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;
export type UserOutput = z.infer<typeof UserOutputSchema>;
