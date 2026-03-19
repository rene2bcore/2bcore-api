import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../services/AuthService.js';

export interface LogoutContext {
  userId: string;
  sessionId: string;
  accessToken: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class LogoutUseCase {
  constructor(
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(ctx: LogoutContext): Promise<void> {
    // Blacklist current access token (prevents reuse within remaining TTL)
    await this.authService.revokeAccessToken(ctx.accessToken);
    // Revoke only the current session (other sessions remain active)
    await this.authService.revokeSession(ctx.userId, ctx.sessionId);

    await this.auditRepo.create({
      userId: ctx.userId,
      action: 'USER_LOGOUT',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId: ctx.sessionId },
    });
  }
}
