import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { UserPublic, toPublicUser } from '../../../domain/entities/User.js';
import { NotFoundError } from '../../../domain/errors/index.js';

export class GetUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(userId: string): Promise<UserPublic> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    return toPublicUser(user);
  }
}
