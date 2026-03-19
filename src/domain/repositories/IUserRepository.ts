import { User } from '../entities/User.js';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role?: 'USER' | 'ADMIN';
}

export interface FindAllUsersOptions {
  page: number;
  limit: number;
}

export interface UserPage {
  data: User[];
  total: number;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(options: FindAllUsersOptions): Promise<UserPage>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<Pick<User, 'isActive' | 'email' | 'passwordHash' | 'role' | 'emailVerified' | 'emailVerifiedAt'>>): Promise<User>;
  delete(id: string): Promise<void>;
}
