import { PrismaClient } from '@prisma/client';
import { IApiKeyRepository, CreateApiKeyInput } from '../../../domain/repositories/IApiKeyRepository.js';
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

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDomain);
  }

  async create(input: CreateApiKeyInput): Promise<ApiKey> {
    const row = await this.prisma.apiKey.create({
      data: {
        userId: input.userId,
        name: input.name,
        keyHash: input.keyHash,
        prefix: input.prefix,
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
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
  }): ApiKey {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      keyHash: row.keyHash,
      prefix: row.prefix,
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }
}
