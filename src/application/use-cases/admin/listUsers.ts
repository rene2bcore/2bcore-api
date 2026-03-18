import { IUserRepository, UserPage } from '../../../domain/repositories/IUserRepository.js';
import { AdminListUsersQuery } from '../../dtos/admin.dto.js';
import { UserPublic, toPublicUser } from '../../../domain/entities/User.js';

export interface UserPublicPage {
  data: UserPublic[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ListUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(query: AdminListUsersQuery): Promise<UserPublicPage> {
    const { page, limit } = query;
    const { data, total }: UserPage = await this.userRepo.findAll({ page, limit });

    return {
      data: data.map(toPublicUser),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
