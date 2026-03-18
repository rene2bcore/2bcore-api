export interface AiUsageLog {
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
}
