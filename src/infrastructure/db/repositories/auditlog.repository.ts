import { PrismaClient, Prisma } from '@prisma/client';
import { IAuditLogRepository, CreateAuditLogInput } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuditLog } from '../../../domain/entities/AuditLog.js';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const row = await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.JsonObject) : Prisma.DbNull,
      },
    });
    return this.toDomain(row);
  }

  async findByUserId(userId: string, limit = 50): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(this.toDomain);
  }

  private toDomain(row: {
    id: string;
    userId: string | null;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: unknown;
    createdAt: Date;
  }): AuditLog {
    return {
      id: row.id,
      userId: row.userId,
      action: row.action as AuditLog['action'],
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }
}
