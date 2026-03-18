import { z } from 'zod';

export const AdminListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuerySchema>;

export const AdminUpdateUserInputSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
}).refine((d) => d.isActive !== undefined || d.role !== undefined, {
  message: 'At least one field (isActive or role) must be provided',
});

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserInputSchema>;

export const AdminListAiUsageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  to: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type AdminListAiUsageQuery = z.infer<typeof AdminListAiUsageQuerySchema>;
