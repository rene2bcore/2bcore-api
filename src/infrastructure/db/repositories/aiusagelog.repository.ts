import { PrismaClient } from '@prisma/client';
import {
  IAiUsageLogRepository,
  CreateAiUsageLogInput,
  FindAiUsageLogsOptions,
  FindAllAiUsageLogsOptions,
  AiUsageLogPage,
} from '../../../domain/repositories/IAiUsageLogRepository.js';
import { AiUsageLog } from '../../../domain/entities/AiUsageLog.js';

export class PrismaAiUsageLogRepository implements IAiUsageLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAiUsageLogInput): Promise<AiUsageLog> {
    const row = await this.prisma.aiUsageLog.create({
      data: {
        userId: input.userId,
        requestId: input.requestId,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.inputTokens + input.outputTokens,
        estimatedCostUsd: input.estimatedCostUsd,
        stream: input.stream,
      },
    });
    return this.toDomain(row);
  }

  async findByUserId(options: FindAiUsageLogsOptions): Promise<AiUsageLogPage> {
    const { userId, page, limit, from, to } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aiUsageLog.count({ where }),
    ]);

    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  async findAll(options: FindAllAiUsageLogsOptions): Promise<AiUsageLogPage> {
    const { page, limit, userId, from, to } = options;
    const skip = (page - 1) * limit;

    const where = {
      ...(userId !== undefined && { userId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aiUsageLog.count({ where }),
    ]);

    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(row: {
    id: string;
    userId: string | null;
    requestId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    stream: boolean;
    createdAt: Date;
  }): AiUsageLog {
    return {
      id: row.id,
      userId: row.userId,
      requestId: row.requestId,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      estimatedCostUsd: row.estimatedCostUsd,
      stream: row.stream,
      createdAt: row.createdAt,
    };
  }
}
