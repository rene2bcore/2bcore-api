import { AiUsageLog } from '../entities/AiUsageLog.js';

export interface CreateAiUsageLogInput {
  userId: string | null;
  requestId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  stream: boolean;
}

export interface FindAiUsageLogsOptions {
  userId: string;
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
}

export interface AiUsageLogPage {
  data: AiUsageLog[];
  total: number;
}

export interface IAiUsageLogRepository {
  create(input: CreateAiUsageLogInput): Promise<AiUsageLog>;
  findByUserId(options: FindAiUsageLogsOptions): Promise<AiUsageLogPage>;
}
