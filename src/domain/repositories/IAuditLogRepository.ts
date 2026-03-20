import { AuditLog, AuditAction } from '../entities/AuditLog.js';

export interface CreateAuditLogInput {
  userId: string | null;
  action: AuditAction;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AuditLogQuery {
  page: number;
  limit: number;
  userId?: string | undefined;
  action?: AuditAction | undefined;
  resourceType?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface AuditLogPage {
  data: AuditLog[];
  total: number;
}

export interface IAuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLog>;
  findByUserId(userId: string, limit?: number): Promise<AuditLog[]>;
  findAll(query: AuditLogQuery): Promise<AuditLogPage>;
}
