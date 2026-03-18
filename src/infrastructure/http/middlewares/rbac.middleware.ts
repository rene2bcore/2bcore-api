import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../../../domain/errors/index.js';
import type { UserRole } from '../../../domain/entities/User.js';

/**
 * RBAC guard factory.
 * Returns a Fastify preHandler that checks the authenticated user's role.
 *
 * Usage:
 *   fastify.get('/admin-route', { preHandler: requireRole('ADMIN') }, handler)
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = request.user;
    if (!user) throw new ForbiddenError();
    if (!roles.includes(user.role as UserRole)) throw new ForbiddenError();
  };
}

/**
 * Ensures the request is authenticated (any role).
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.user) throw new ForbiddenError();
}
