import { ApiKey } from '../entities/ApiKey.js';

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
}

export interface IApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  findByUserId(userId: string): Promise<ApiKey[]>;
  create(input: CreateApiKeyInput): Promise<ApiKey>;
  revoke(id: string): Promise<ApiKey>;
  updateLastUsed(id: string): Promise<void>;
}
