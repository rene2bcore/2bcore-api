import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../services/AuthService.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import type { IWebhookService } from '../../../domain/services/IWebhookService.js';
import { WEBHOOK_EVENTS } from '../../../shared/constants/index.js';

export interface DeleteUserContext {
  adminId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class DeleteUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
    private readonly webhookService?: IWebhookService,
  ) {}

  async execute(targetUserId: string, ctx: DeleteUserContext): Promise<void> {
    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw new NotFoundError('User');

    // Emit webhook before deletion — user row will be gone after
    this.webhookService?.emit(targetUserId, WEBHOOK_EVENTS.USER_DELETED, {
      id: targetUserId,
      email: user.email,
      deletedByAdmin: ctx.adminId,
    });

    // Write audit log BEFORE deletion — captures the email before cascade
    await this.auditRepo.create({
      userId: ctx.adminId,
      action: 'RESOURCE_DELETED',
      resourceType: 'user',
      resourceId: targetUserId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { adminAction: true, deletedEmail: user.email },
    });

    // Hard-delete: cascades to ApiKeys, sets AuditLog.userId to null
    await this.userRepo.delete(targetUserId);

    // Revoke any active tokens for the deleted user — fire-and-forget
    await Promise.allSettled([
      this.authService.revokeRefreshToken(targetUserId),
    ]);
  }
}
