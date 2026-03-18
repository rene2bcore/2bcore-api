/**
 * Seed script: creates an initial admin user for development.
 * Usage: npm run prisma:seed
 */
import { getPrismaClient, connectDB, disconnectDB } from './prisma.js';
import bcrypt from 'bcryptjs';

async function seed(): Promise<void> {
  await connectDB();
  const prisma = getPrismaClient();

  const adminEmail = 'admin@2bcore.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing) {
    console.log(`Seed: admin user already exists (${adminEmail})`);
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@2bcore!', 12);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`Seed: created admin user ${admin.email} (id: ${admin.id})`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => disconnectDB());
