import type { FastifyInstance } from 'fastify';
import { ChatInputSchema } from '../../../application/dtos/ai.dto.js';
import { ChatUseCase } from '../../../application/use-cases/ai/chat.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';
import { logger } from '../../observability/logger.js';

interface AiRoutesOptions {
  chatUseCase: ChatUseCase;
}

export async function aiRoutes(fastify: FastifyInstance, opts: AiRoutesOptions): Promise<void> {
  const { chatUseCase } = opts;
  const verifyAuth = (fastify as any).verifyAuth;

  // ── POST /v1/ai/chat ────────────────────────────────────────────────
  fastify.post('/chat', {
    preHandler: [verifyAuth],
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
}
