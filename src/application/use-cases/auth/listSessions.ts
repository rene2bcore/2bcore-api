import { AuthService } from '../../services/AuthService.js';

export interface SessionInfo {
  sessionId: string;
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  ipAddress?: string;
  userAgent?: string;
}

export class ListSessionsUseCase {
  constructor(private readonly authService: AuthService) {}

  async execute(userId: string): Promise<SessionInfo[]> {
    const sessions = await this.authService.listSessions(userId);
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      createdAt: new Date(s.createdAt).toISOString(),
      expiresAt: new Date(s.expiresAt).toISOString(),
      ...(s.ipAddress !== undefined && { ipAddress: s.ipAddress }),
      ...(s.userAgent !== undefined && { userAgent: s.userAgent }),
    }));
  }
}
