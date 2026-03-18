import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService, TokenPair } from '../../services/AuthService.js';
import { TokenRevokedError, NotFoundError } from '../../../domain/errors/index.js';
import { sha256 } from '../../../shared/utils/crypto.js';

export interface RefreshContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: AuthService,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(
    userId: string,
    refreshToken: string,
    ctx: RefreshContext,
  ): Promise<TokenPair> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundError('User');
    }

    const refreshHash = sha256(refreshToken);
    const isValid = await this.authService.verifyRefreshToken(userId, refreshToken);
    if (!isValid) {
      throw new TokenRevokedError();
    }

    // Rotate: revoke old, issue new
    await this.authService.revokeRefreshToken(userId);
    const newTokenPair = await this.authService.issueTokenPair(userId, user.email, user.role);

    await this.auditRepo.create({
      userId,
      action: 'TOKEN_REFRESHED',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return newTokenPair;
  }
}
