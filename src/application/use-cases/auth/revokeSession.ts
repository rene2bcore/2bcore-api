import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../services/AuthService.js';

export interface RevokeSessionContext {
  requestingUserId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class RevokeSessionUseCase {
  constructor(
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(userId: string, sessionId: string, ctx: RevokeSessionContext): Promise<void> {
    await this.authService.revokeSession(userId, sessionId);

    await this.auditRepo.create({
      userId,
      action: 'USER_LOGOUT',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId, revokedBy: ctx.requestingUserId },
    });
  }
}
