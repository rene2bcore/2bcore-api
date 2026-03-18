import { User } from '../entities/User.js';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role?: 'USER' | 'ADMIN';
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<Pick<User, 'isActive' | 'passwordHash'>>): Promise<User>;
}
