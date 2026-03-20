export interface TotpSecret {
  id: string;
  userId: string;
  secret: string; // base32-encoded TOTP secret
  isEnabled: boolean;
  backupCodes: string[]; // hashed backup codes
  enabledAt: Date | null;
  createdAt: Date;
}

export interface TotpSecretPublic {
  isEnabled: boolean;
  enabledAt: Date | null;
}
