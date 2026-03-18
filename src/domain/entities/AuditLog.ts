export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'TOKEN_REFRESHED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'PASSWORD_CHANGED'
  | 'RESOURCE_CREATED'
  | 'RESOURCE_UPDATED'
  | 'RESOURCE_DELETED';

export interface AuditLog {
  id: string;
  userId: string | null;
  action: AuditAction;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
