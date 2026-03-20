import { IAuditLogRepository, AuditLogQuery } from '../../../domain/repositories/IAuditLogRepository.js';
import { AuditLog } from '../../../domain/entities/AuditLog.js';

export interface AuditLogPage {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ListAuditLogsUseCase {
  constructor(private readonly auditRepo: IAuditLogRepository) {}

  async execute(query: AuditLogQuery): Promise<AuditLogPage> {
    const { data, total } = await this.auditRepo.findAll(query);
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
