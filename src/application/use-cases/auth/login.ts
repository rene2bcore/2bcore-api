import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService, TokenPair } from '../../services/AuthService.js';
import { InvalidCredentialsError, UnauthorizedError } from '../../../domain/errors/index.js';
import { LoginInput } from '../../dtos/auth.dto.js';

export interface LoginContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface LoginResult extends TokenPair {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(input: LoginInput, ctx: LoginContext): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(input.email);

    if (!user) {
      // Use constant-time comparison to prevent timing oracle
      await bcrypt.compare(input.password, '$2a$12$invalidhashusedfortimingsafety00000000000000000');
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      await this.auditRepo.create({
        userId: user.id,
        action: 'USER_LOGIN',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { success: false, reason: 'invalid_password' },
      });
      throw new InvalidCredentialsError();
    }

    const tokenPair = await this.authService.issueTokenPair(user.id, user.email, user.role, {
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    });

    await this.auditRepo.create({
      userId: user.id,
      action: 'USER_LOGIN',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { success: true, sessionId: tokenPair.sessionId },
    });

    return {
      ...tokenPair,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
