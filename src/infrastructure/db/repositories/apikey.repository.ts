import { PrismaClient } from '@prisma/client';
import { IApiKeyRepository, CreateApiKeyInput, RotateApiKeyInput, FindApiKeysByUserIdOptions, ApiKeyPage } from '../../../domain/repositories/IApiKeyRepository.js';
import { ApiKey } from '../../../domain/entities/ApiKey.js';

export class PrismaApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.prisma.apiKey.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const row = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    return row ? this.toDomain(row) : null;
  }

  async findByUserId(userId: string, options?: FindApiKeysByUserIdOptions): Promise<ApiKey[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      ...(options !== undefined && {
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByUserIdPaged(userId: string, options: FindApiKeysByUserIdOptions): Promise<ApiKeyPage> {
    const { page, limit } = options;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.apiKey.count({ where: { userId } }),
    ]);
    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  async create(input: CreateApiKeyInput): Promise<ApiKey> {
    const row = await this.prisma.apiKey.create({
      data: {
        userId: input.userId,
        name: input.name,
        keyHash: input.keyHash,
        prefix: input.prefix,
        scopes: input.scopes ?? [],
        ...(input.rateLimit !== undefined && { rateLimit: input.rateLimit }),
      },
    });
    return this.toDomain(row);
  }

  async rotate(id: string, input: RotateApiKeyInput): Promise<ApiKey> {
    const row = await this.prisma.apiKey.update({
      where: { id },
      data: {
        keyHash: input.keyHash,
        prefix: input.prefix,
        lastUsedAt: null,
        revokedAt: null,
        isActive: true,
      },
    });
    return this.toDomain(row);
  }

  async revoke(id: string): Promise<ApiKey> {
    const row = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
    return this.toDomain(row);
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  private toDomain(row: {
    id: string;
    userId: string;
    name: string;
    keyHash: string;
    prefix: string;
    scopes: unknown;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
    rateLimit?: number | null;
  }): ApiKey {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      keyHash: row.keyHash,
      prefix: row.prefix,
      scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
      rateLimit: row.rateLimit ?? null,
    };
  }
}
