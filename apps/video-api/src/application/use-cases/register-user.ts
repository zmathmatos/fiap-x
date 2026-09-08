import { ValidationError } from '@fiapx/shared';
import type { UserRepository } from '../../domain/ports/user-repository';
import type { PasswordHasher } from '../../domain/ports/password-hasher';
import type { TokenService } from '../../domain/ports/token-service';
import { normaliseEmail, assertValidEmail, MIN_PASSWORD_LENGTH } from './validation';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  user: { id: string; name: string; email: string; createdAt: string };
  token: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResult> {
    const name = input.name.trim();
    const email = normaliseEmail(input.email);

    if (name.length === 0) {
      throw new ValidationError('O nome é obrigatório.');
    }
    assertValidEmail(email);
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`A senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    if (await this.users.findByEmail(email)) {
      throw new ValidationError('E-mail já cadastrado.');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({ name, email, passwordHash });

    return {
      user: user.toPublic(),
      token: this.tokens.sign({ sub: user.id, email: user.email }),
    };
  }
}
