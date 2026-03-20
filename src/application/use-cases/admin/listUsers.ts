import { IUserRepository, UserPage } from '../../../domain/repositories/IUserRepository.js';
import { AdminListUsersQuery } from '../../dtos/admin.dto.js';
import { UserPublic, toPublicUser } from '../../../domain/entities/User.js';

export interface UserPublicPage {
  data: UserPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(query: AdminListUsersQuery): Promise<UserPublicPage> {
    const { page, limit } = query;
    const { data, total }: UserPage = await this.userRepo.findAll({ page, limit });

    return {
      data: data.map(toPublicUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
