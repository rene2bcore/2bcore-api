import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../../src/infrastructure/db/prisma.js';
import type { User } from '../../../src/domain/entities/User.js';

export const TEST_EMAIL_DOMAIN = '@2bcore.test';
export const TEST_PASSWORD = 'Integration@Pass1!';

export interface SeedUserResult {
  user: User;
  password: string;
}

export async function seedTestUser(overrides?: {
  email?: string;
  password?: string;
  role?: 'USER' | 'ADMIN';
  isActive?: boolean;
}): Promise<SeedUserResult> {
  const prisma = getPrismaClient();
  const email = overrides?.email ?? `inttest+${uuidv4()}${TEST_EMAIL_DOMAIN}`;
  const password = overrides?.password ?? TEST_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);

  const row = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: overrides?.role ?? 'USER',
      isActive: overrides?.isActive ?? true,
    },
  });

  return {
    user: {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      isActive: row.isActive,
      emailVerified: row.emailVerified,
      emailVerifiedAt: row.emailVerifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    password,
  };
}

export async function seedAdminUser(overrides?: { email?: string; password?: string }): Promise<SeedUserResult> {
  return seedTestUser({ ...overrides, role: 'ADMIN' });
}

export async function cleanupIntegrationData(): Promise<void> {
  const prisma = getPrismaClient();
  try {
    // AuditLogs for test users (not yet SetNull'd)
    await prisma.auditLog.deleteMany({
      where: { user: { email: { contains: TEST_EMAIL_DOMAIN } } },
    });
    // Users (cascades to ApiKeys)
    await prisma.user.deleteMany({
      where: { email: { contains: TEST_EMAIL_DOMAIN } },
    });
  } catch (err) {
    console.warn('[test] cleanupIntegrationData error (non-fatal):', err);
  }
}
