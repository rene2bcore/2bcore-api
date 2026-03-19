export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IEmailVerificationRepository {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<EmailVerificationToken>;
  findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null>;
  markUsed(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
