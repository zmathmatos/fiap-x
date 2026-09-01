import { NotFoundError } from '@fiapx/shared';
import type { UserRepository } from '../../domain/ports/user-repository';

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
  }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    return user.toPublic();
  }
}
