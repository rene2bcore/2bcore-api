import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService } from '../../services/AuthService.js';
import { NotFoundError, InvalidCredentialsError } from '../../../domain/errors/index.js';

export interface DeleteMeContext {
  accessToken: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class DeleteMeUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(userId: string, password: string, ctx: DeleteMeContext): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new InvalidCredentialsError();

    // Write audit log before deletion — AuditLog.userId → SetNull on cascade
    await this.auditRepo.create({
      userId,
      action: 'RESOURCE_DELETED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: user.email },
    });

    // Hard-delete: cascades to ApiKeys, sets AuditLog.userId to null
    await this.userRepo.delete(userId);

    // Invalidate tokens — fire-and-forget (user is already gone)
    await Promise.allSettled([
      this.authService.revokeAccessToken(ctx.accessToken),
      this.authService.revokeRefreshToken(userId),
    ]);
  }
}
