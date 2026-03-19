import type { FastifyInstance } from 'fastify';
import { ChatInputSchema } from '../../../application/dtos/ai.dto.js';
import { AiUsageQuerySchema } from '../../../application/dtos/aiusage.dto.js';
import { ChatUseCase } from '../../../application/use-cases/ai/chat.js';
import { GetAiUsageUseCase } from '../../../application/use-cases/ai/getUsage.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { logger } from '../../observability/logger.js';
import { aiRateLimitConfig } from '../plugins/rateLimit.plugin.js';

interface AiRoutesOptions {
  chatUseCase: ChatUseCase;
  getAiUsageUseCase: GetAiUsageUseCase;
}

const ErrorResponse = { $ref: 'ErrorResponse#' };

export async function aiRoutes(fastify: FastifyInstance, opts: AiRoutesOptions): Promise<void> {
  const { chatUseCase, getAiUsageUseCase } = opts;
  const verifyAuth = (fastify as any).verifyAuth;
  const verifyJWT = (fastify as any).verifyJWT;
  const requireScope = (fastify as any).requireScope;

  // ── POST /v1/ai/chat ────────────────────────────────────────────────
  fastify.post('/chat', {
    ...aiRateLimitConfig,
    schema: {
      tags: ['AI'],
      summary: 'Chat completion',
      description:
        'Send a conversation to the AI and receive a response. ' +
        'Set `stream: true` for Server-Sent Events (SSE) streaming. ' +
        'Use `model` to select a tier: `fast` (Haiku), `standard` (Sonnet, default), or `powerful` (Opus).',
      security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string', minLength: 1 },
              },
            },
          },
          system: { type: 'string', maxLength: 10000, description: 'Optional system prompt' },
          model: {
            type: 'string',
            description: 'Tier name (`fast`, `standard`, `powerful`) or exact model ID. Defaults to `standard`.',
          },
          maxTokens: { type: 'number', minimum: 1, maximum: 8192, description: 'Max tokens in the response' },
          stream: { type: 'boolean', default: false, description: 'Return SSE stream instead of JSON' },
        },
      },
      response: {
        200: {
          description: 'Non-streaming response (when `stream: false`)',
          type: 'object',
          properties: {
            id: { type: 'string' },
            model: { type: 'string' },
            content: { type: 'string' },
            usage: {
              type: 'object',
              properties: {
                inputTokens: { type: 'number' },
                outputTokens: { type: 'number' },
                totalTokens: { type: 'number' },
                estimatedCostUsd: { type: 'number' },
              },
              required: ['inputTokens', 'outputTokens', 'totalTokens', 'estimatedCostUsd'],
            },
          },
          required: ['id', 'model', 'content', 'usage'],
        },
        401: ErrorResponse,
        422: ErrorResponse,
        429: ErrorResponse,
        500: ErrorResponse,
      },
    },
    preHandler: [verifyAuth, requireScope('ai:chat')],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const body = ChatInputSchema.parse(request.body);

      // ── Streaming ────────────────────────────────────────────────────
      if (body.stream) {
        // Budget check BEFORE hijacking — allows Fastify to send a proper 429 JSON error
        await chatUseCase.checkBudget(userId);

        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        try {
          for await (const chunk of chatUseCase.executeStream(userId, body, {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        } catch (err) {
          const domainErr = err as { code?: string; message?: string };
          logger.error({ err, userId }, 'AI stream error');
          res.write(`event: error\ndata: ${JSON.stringify({ code: domainErr.code ?? 'GEN_500', message: domainErr.message ?? 'Stream error' })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // ── Non-streaming ────────────────────────────────────────────────
      const result = await chatUseCase.execute(userId, body, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── GET /v1/ai/usage ─────────────────────────────────────────────────
  fastify.get('/usage', {
    schema: {
      tags: ['AI'],
      summary: 'AI usage history',
      description: 'Paginated list of AI usage logs for the authenticated user, with token and cost summary.',
      security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          from: { type: 'string', format: 'date-time', description: 'ISO 8601 start date (inclusive)' },
          to: { type: 'string', format: 'date-time', description: 'ISO 8601 end date (inclusive)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: ['string', 'null'] },
                  requestId: { type: 'string' },
                  model: { type: 'string' },
                  inputTokens: { type: 'integer' },
                  outputTokens: { type: 'integer' },
                  totalTokens: { type: 'integer' },
                  estimatedCostUsd: { type: 'number' },
                  stream: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
                required: ['id', 'requestId', 'model', 'inputTokens', 'outputTokens', 'totalTokens', 'estimatedCostUsd', 'stream', 'createdAt'],
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
              required: ['page', 'limit', 'total', 'totalPages'],
            },
            summary: {
              type: 'object',
              properties: {
                totalInputTokens: { type: 'integer' },
                totalOutputTokens: { type: 'integer' },
                totalTokens: { type: 'integer' },
                totalCostUsd: { type: 'number' },
              },
              required: ['totalInputTokens', 'totalOutputTokens', 'totalTokens', 'totalCostUsd'],
            },
          },
          required: ['data', 'pagination', 'summary'],
        },
        401: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: [verifyAuth, requireScope('ai:usage')],
    handler: async (request, reply) => {
      const userId = request.user!.sub;
      const query = AiUsageQuerySchema.parse(request.query);
      const result = await getAiUsageUseCase.execute(userId, query);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });
}
