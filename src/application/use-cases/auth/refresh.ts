import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IAuditLogRepository } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuthService, TokenPair } from '../../services/AuthService.js';
import { TokenRevokedError, NotFoundError } from '../../../domain/errors/index.js';

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
    /** Cookie value: `<sessionId>.<refreshToken>` */
    cookieValue: string,
    ctx: RefreshContext,
  ): Promise<TokenPair> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundError('User');
    }

    const parsed = this.authService.parseRefreshCookie(cookieValue);
    if (!parsed) {
      throw new TokenRevokedError();
    }
    const { sessionId, refreshToken } = parsed;

    const isValid = await this.authService.verifyRefreshToken(userId, sessionId, refreshToken);
    if (!isValid) {
      throw new TokenRevokedError();
    }

    // Rotate: revoke old session, issue new one
    await this.authService.revokeSession(userId, sessionId);
    const newTokenPair = await this.authService.issueTokenPair(userId, user.email, user.role, {
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    });

    await this.auditRepo.create({
      userId,
      action: 'TOKEN_REFRESHED',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { oldSessionId: sessionId, newSessionId: newTokenPair.sessionId },
    });

    return newTokenPair;
  }
}
