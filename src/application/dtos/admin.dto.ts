import { z } from 'zod';
import { AuditAction } from '../../domain/entities/AuditLog.js';

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

const AUDIT_ACTIONS: [AuditAction, ...AuditAction[]] = [
  'USER_LOGIN', 'USER_LOGOUT', 'TOKEN_REFRESHED', 'SESSION_REVOKED',
  'API_KEY_CREATED', 'API_KEY_REVOKED', 'PASSWORD_CHANGED',
  'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'RESOURCE_DELETED',
  'AI_CHAT_REQUEST', 'USER_EMAIL_VERIFIED',
  'USER_PASSWORD_RESET_REQUESTED', 'USER_PASSWORD_RESET',
  'TOTP_ENABLED', 'TOTP_DISABLED', 'TOTP_CHALLENGE_FAILED',
];

export const AdminListAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  resourceType: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  to: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type AdminListAuditLogsQuery = z.infer<typeof AdminListAuditLogsQuerySchema>;
