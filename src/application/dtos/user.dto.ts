import { z } from 'zod';

const StrongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const RegisterUserInputSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: StrongPassword,
});

export const UpdateMeInputSchema = z
  .object({
    email: z.string().email('Invalid email format').toLowerCase().trim().optional(),
    currentPassword: z.string().optional(),
    newPassword: StrongPassword.optional(),
  })
  .refine((d) => d.email !== undefined || d.newPassword !== undefined, {
    message: 'At least one field (email or newPassword) must be provided',
  })
  .refine((d) => !d.newPassword || d.currentPassword, {
    message: 'currentPassword is required when setting a new password',
    path: ['currentPassword'],
  });

export const DeleteMeInputSchema = z.object({
  password: z.string().min(1, 'Password is required to confirm account deletion'),
});

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;
export type UpdateMeInput = z.infer<typeof UpdateMeInputSchema>;
export type DeleteMeInput = z.infer<typeof DeleteMeInputSchema>;
export type UserOutput = z.infer<typeof UserOutputSchema>;
