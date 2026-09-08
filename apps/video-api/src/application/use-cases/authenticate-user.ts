import { UnauthorizedError } from '@fiapx/shared';
import type { UserRepository } from '../../domain/ports/user-repository';
import type { PasswordHasher } from '../../domain/ports/password-hasher';
import type { TokenService } from '../../domain/ports/token-service';
import { normaliseEmail } from './validation';
import type { AuthResult } from './register-user';

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO3Zx0Rr2K1eKq6H3sVvJZ3JQ2Fj9Rzcy';

export class AuthenticateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthResult> {
    const email = normaliseEmail(input.email);
    const user = await this.users.findByEmail(email);

    const matches = await this.hasher.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !matches) {
      throw new UnauthorizedError();
    }

    return {
      user: user.toPublic(),
      token: this.tokens.sign({ sub: user.id, email: user.email }),
    };
  }
}
