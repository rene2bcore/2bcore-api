import { ApiKey } from '../entities/ApiKey.js';

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes?: string[];
  rateLimit?: number;
}

export interface RotateApiKeyInput {
  keyHash: string;
  prefix: string;
}

export interface FindApiKeysByUserIdOptions {
  page: number;
  limit: number;
}

export interface ApiKeyPage {
  data: ApiKey[];
  total: number;
}

export interface IApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  findByUserId(userId: string, options?: FindApiKeysByUserIdOptions): Promise<ApiKey[]>;
  findByUserIdPaged(userId: string, options: FindApiKeysByUserIdOptions): Promise<ApiKeyPage>;
  create(input: CreateApiKeyInput): Promise<ApiKey>;
  rotate(id: string, input: RotateApiKeyInput): Promise<ApiKey>;
  revoke(id: string): Promise<ApiKey>;
  updateLastUsed(id: string): Promise<void>;
}
