export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  prefix: string; // e.g. "sk-live-xxxx" (first 12 chars shown as hint)
  scopes: string[]; // empty = wildcard (full access)
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface ApiKeyPublic {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export function toPublicApiKey(key: ApiKey): ApiKeyPublic {
  return {
    id: key.id,
    userId: key.userId,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
  };
}
