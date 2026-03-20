import { IApiKeyRepository } from '../../../domain/repositories/IApiKeyRepository.js';
import { toPublicApiKey, ApiKeyPublic } from '../../../domain/entities/ApiKey.js';

export interface ListApiKeysQuery {
  page: number;
  limit: number;
}

export interface ApiKeyPublicPage {
  data: ApiKeyPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListApiKeysUseCase {
  constructor(private readonly apiKeyRepo: IApiKeyRepository) {}

  async execute(userId: string, query: ListApiKeysQuery): Promise<ApiKeyPublicPage> {
    const { page, limit } = query;
    const { data, total } = await this.apiKeyRepo.findByUserIdPaged(userId, { page, limit });
    return {
      data: data.map(toPublicApiKey),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
