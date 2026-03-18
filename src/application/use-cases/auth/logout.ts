import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../services/AuthService.js';

export interface LogoutContext {
  userId: string;
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
    // Blacklist the current access token
    await this.authService.revokeAccessToken(ctx.accessToken);
    // Revoke the refresh token
    await this.authService.revokeRefreshToken(ctx.userId);

    await this.auditRepo.create({
      userId: ctx.userId,
      action: 'USER_LOGOUT',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }
}
