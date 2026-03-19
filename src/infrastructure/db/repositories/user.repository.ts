import { PrismaClient } from '@prisma/client';
import { IUserRepository, CreateUserInput, FindAllUsersOptions, UserPage } from '../../../domain/repositories/IUserRepository.js';
import { User } from '../../../domain/entities/User.js';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findAll({ page, limit }: FindAllUsersOptions): Promise<UserPage> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.user.count(),
    ]);
    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role ?? 'USER',
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: Partial<Pick<User, 'isActive' | 'email' | 'passwordHash' | 'role' | 'emailVerified' | 'emailVerifiedAt'>>): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.email && { email: data.email }),
        ...(data.passwordHash && { passwordHash: data.passwordHash }),
        ...(data.role && { role: data.role }),
        ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
        ...(data.emailVerifiedAt !== undefined && { emailVerifiedAt: data.emailVerifiedAt }),
      },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  private toDomain(row: {
    id: string;
    email: string;
    passwordHash: string;
    role: 'USER' | 'ADMIN';
    isActive: boolean;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      isActive: row.isActive,
      emailVerified: row.emailVerified,
      emailVerifiedAt: row.emailVerifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
