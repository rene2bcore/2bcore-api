import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { UserPublic, toPublicUser } from '../../../domain/entities/User.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import { AdminUpdateUserInput } from '../../dtos/admin.dto.js';

export interface UpdateUserContext {
  adminId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class UpdateUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(targetUserId: string, input: AdminUpdateUserInput, ctx: UpdateUserContext): Promise<UserPublic> {
    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw new NotFoundError('User');

    const updated = await this.userRepo.update(targetUserId, {
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.role !== undefined && { role: input.role }),
    });

    await this.auditRepo.create({
      userId: ctx.adminId,
      action: 'RESOURCE_UPDATED',
      resourceType: 'user',
      resourceId: targetUserId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { adminAction: true, changes: input },
    });

    return toPublicUser(updated);
  }
}
