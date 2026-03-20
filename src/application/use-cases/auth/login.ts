import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { ITotpRepository } from '../../../domain/repositories/ITotpRepository.js';
import { AuthService, TokenPair } from '../../services/AuthService.js';
import { InvalidCredentialsError, UnauthorizedError, EmailNotVerifiedError } from '../../../domain/errors/index.js';
import { LoginInput } from '../../dtos/auth.dto.js';

export interface LoginContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export type LoginResult =
  | ({ requires2fa: false } & TokenPair & { user: { id: string; email: string; role: string } })
  | { requires2fa: true; challengeToken: string };

export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
    private readonly totpRepo?: ITotpRepository,
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

    // Enforce email verification — must be verified before a full session is issued
    if (!user.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    // Check if 2FA is enabled — if so, issue challenge token instead of full session
    if (this.totpRepo) {
      const totp = await this.totpRepo.findByUserId(user.id);
      if (totp?.isEnabled) {
        const challengeToken = this.authService.issueChallengeToken(user.id, user.email, user.role);
        return { requires2fa: true, challengeToken };
      }
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
      requires2fa: false,
      ...tokenPair,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
