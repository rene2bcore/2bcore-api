import type { FastifyInstance } from 'fastify';
import { AdminListUsersQuerySchema, AdminUpdateUserInputSchema, AdminListAiUsageQuerySchema } from '../../../application/dtos/admin.dto.js';
import { ListUsersUseCase } from '../../../application/use-cases/admin/listUsers.js';
import { GetUserUseCase } from '../../../application/use-cases/admin/getUser.js';
import { UpdateUserUseCase } from '../../../application/use-cases/admin/updateUser.js';
import { DeleteUserUseCase } from '../../../application/use-cases/admin/deleteUser.js';
import { GetAllAiUsageUseCase } from '../../../application/use-cases/admin/getAllAiUsage.js';
import { HTTP_STATUS } from '../../../shared/constants/index.js';

interface AdminRoutesOptions {
  listUsersUseCase: ListUsersUseCase;
  getUserUseCase: GetUserUseCase;
  updateUserUseCase: UpdateUserUseCase;
  deleteUserUseCase: DeleteUserUseCase;
  getAllAiUsageUseCase: GetAllAiUsageUseCase;
}

const ErrorResponse = { $ref: 'ErrorResponse#' };

const UserPublicSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['USER', 'ADMIN'] },
    isActive: { type: 'boolean' },
    emailVerified: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'email', 'role', 'isActive', 'emailVerified', 'createdAt'],
} as const;

export async function adminRoutes(fastify: FastifyInstance, opts: AdminRoutesOptions): Promise<void> {
  const { listUsersUseCase, getUserUseCase, updateUserUseCase, deleteUserUseCase, getAllAiUsageUseCase } = opts;
  const verifyJWT = (fastify as any).verifyJWT;
  const requireAdmin = (fastify as any).requireAdmin;
  const adminGuard = [verifyJWT, requireAdmin];

  // ── GET /v1/admin/users ─────────────────────────────────────────────
  fastify.get('/users', {
    schema: {
      tags: ['Admin'],
      summary: 'List all users',
      description: 'Paginated list of all registered users. Requires ADMIN role.',
      security: [{ BearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: UserPublicSchema },
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
          },
          required: ['data', 'pagination'],
        },
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
    preHandler: adminGuard,
    handler: async (request, reply) => {
      const query = AdminListUsersQuerySchema.parse(request.query);
      const result = await listUsersUseCase.execute(query);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── GET /v1/admin/users/:id ─────────────────────────────────────────
  fastify.get('/users/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Get user by ID',
      description: 'Retrieve a single user by their ID. Requires ADMIN role.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: UserPublicSchema,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: adminGuard,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await getUserUseCase.execute(id);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── PATCH /v1/admin/users/:id ───────────────────────────────────────
  fastify.patch('/users/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Update user',
      description: 'Update a user\'s `isActive` status or `role`. Requires ADMIN role.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean', description: 'Activate or deactivate the user account' },
          role: { type: 'string', enum: ['USER', 'ADMIN'], description: 'Assign a new role' },
        },
      },
      response: {
        200: UserPublicSchema,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: adminGuard,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const input = AdminUpdateUserInputSchema.parse(request.body);
      const result = await updateUserUseCase.execute(id, input, {
        adminId: request.user!.sub,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });

  // ── DELETE /v1/admin/users/:id ─────────────────────────────────────
  fastify.delete('/users/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Delete user (GDPR hard-delete)',
      description: 'Permanently delete a user account and cascade-delete their API keys. AuditLog entries are preserved with userId set to null. Requires ADMIN role.',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        204: { type: 'null', description: 'User deleted' },
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    preHandler: adminGuard,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteUserUseCase.execute(id, {
        adminId: request.user!.sub,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.status(HTTP_STATUS.NO_CONTENT).send();
    },
  });

  // ── GET /v1/admin/ai/usage ──────────────────────────────────────────
  fastify.get('/ai/usage', {
    schema: {
      tags: ['Admin'],
      summary: 'All AI usage logs',
      description: 'Cross-user AI usage history with optional userId filter. Requires ADMIN role.',
      security: [{ BearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          userId: { type: 'string', description: 'Filter by a specific user ID' },
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
        403: ErrorResponse,
        422: ErrorResponse,
      },
    },
    preHandler: adminGuard,
    handler: async (request, reply) => {
      const query = AdminListAiUsageQuerySchema.parse(request.query);
      const result = await getAllAiUsageUseCase.execute(query);
      return reply.status(HTTP_STATUS.OK).send(result);
    },
  });
}
