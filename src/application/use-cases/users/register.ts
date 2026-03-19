import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { UserAlreadyExistsError } from '../../../domain/errors/index.js';
import { UserPublic, toPublicUser } from '../../../domain/entities/User.js';
import { RegisterUserInput } from '../../dtos/user.dto.js';
import { env } from '../../../shared/config/env.js';
import { logger } from '../../../infrastructure/observability/logger.js';
import type { SendVerificationEmailUseCase } from '../auth/sendVerificationEmail.js';
import type { IWebhookService } from '../../../domain/services/IWebhookService.js';
import { WEBHOOK_EVENTS } from '../../../shared/constants/index.js';

export interface RegisterContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly sendVerificationEmailUseCase?: SendVerificationEmailUseCase,
    private readonly webhookService?: IWebhookService,
  ) {}

  async execute(input: RegisterUserInput, ctx: RegisterContext): Promise<UserPublic> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const user = await this.userRepo.create({ email: input.email, passwordHash, role: 'USER' });

    await this.auditRepo.create({
      userId: user.id,
      action: 'RESOURCE_CREATED',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: user.email },
    });

    // Fire-and-forget — registration succeeds even if email sending fails
    if (this.sendVerificationEmailUseCase) {
      void this.sendVerificationEmailUseCase.execute(user.id).catch((err: unknown) => {
        logger.warn({ err, userId: user.id }, 'Failed to send verification email after registration');
      });
    }

    this.webhookService?.emit(user.id, WEBHOOK_EVENTS.USER_CREATED, {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });

    return toPublicUser(user);
  }
}
