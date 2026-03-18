import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { NotFoundError, InvalidCredentialsError, UserAlreadyExistsError } from '../../../domain/errors/index.js';
import { UserPublic, toPublicUser } from '../../../domain/entities/User.js';
import { UpdateMeInput } from '../../dtos/user.dto.js';
import { env } from '../../../shared/config/env.js';

export interface UpdateMeContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class UpdateMeUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(userId: string, input: UpdateMeInput, ctx: UpdateMeContext): Promise<UserPublic> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');

    const updates: Partial<{ email: string; passwordHash: string }> = {};
    const auditMetadata: Record<string, unknown> = {};

    // ── Email change ─────────────────────────────────────────────────
    if (input.email !== undefined && input.email !== user.email) {
      const existing = await this.userRepo.findByEmail(input.email);
      if (existing) throw new UserAlreadyExistsError();
      updates.email = input.email;
      auditMetadata.emailChanged = true;
    }

    // ── Password change ──────────────────────────────────────────────
    if (input.newPassword) {
      const match = await bcrypt.compare(input.currentPassword!, user.passwordHash);
      if (!match) throw new InvalidCredentialsError();
      updates.passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
      auditMetadata.passwordChanged = true;
    }

    const updated = await this.userRepo.update(userId, updates);

    await this.auditRepo.create({
      userId,
      action: auditMetadata.passwordChanged ? 'PASSWORD_CHANGED' : 'RESOURCE_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: auditMetadata,
    });

    return toPublicUser(updated);
  }
}
