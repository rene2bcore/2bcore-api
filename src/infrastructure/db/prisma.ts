import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger.js';

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }
  return prisma;
}

export async function connectDB(): Promise<void> {
  await getPrismaClient().$connect();
  logger.info('Database connected');
}

export async function disconnectDB(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info('Database disconnected');
  }
}

export async function pingDB(): Promise<boolean> {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
