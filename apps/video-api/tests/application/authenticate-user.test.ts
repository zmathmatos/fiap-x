import { AuthenticateUserUseCase } from '../../src/application/use-cases/authenticate-user';
import { UnauthorizedError } from '@fiapx/shared';
import { User } from '../../src/domain/entities/user';
import type { UserRepository } from '../../src/domain/ports/user-repository';
import type { PasswordHasher } from '../../src/domain/ports/password-hasher';
import type { TokenService } from '../../src/domain/ports/token-service';

const user = new User({
  id: 'u1',
  name: 'Ana',
  email: 'a@b.c',
  passwordHash: 'hashed',
  createdAt: new Date('2026-09-01T12:00:00Z'),
});

const tokens: TokenService = {
  sign: (payload) => `token-for-${payload.sub}`,
  verify: () => ({ sub: 'u1', email: 'a@b.c' }),
};

function makeUsers(found: User | null): UserRepository {
  return {
    findByEmail: jest.fn().mockResolvedValue(found),
    findById: jest.fn(),
    create: jest.fn(),
  } as unknown as UserRepository;
}

function makeHasher(matches: boolean): PasswordHasher {
  return { hash: jest.fn(), compare: jest.fn().mockResolvedValue(matches) };
}

/** Runs a rejecting call and hands back the error, typed as an Error. */
async function captureError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected the call to reject, but it resolved');
}

describe('AuthenticateUserUseCase', () => {
  it('returns the user and a token on valid credentials', async () => {
    const useCase = new AuthenticateUserUseCase(makeUsers(user), makeHasher(true), tokens);

    const result = await useCase.execute({ email: 'a@b.c', password: 'secret123' });

    expect(result.token).toBe('token-for-u1');
    expect(result.user).toEqual({
      id: 'u1',
      name: 'Ana',
      email: 'a@b.c',
      createdAt: '2026-09-01T12:00:00.000Z',
    });
  });

  it('throws the same error for an unknown e-mail and a wrong password', async () => {
    const unknownEmail = new AuthenticateUserUseCase(makeUsers(null), makeHasher(true), tokens);
    const wrongPassword = new AuthenticateUserUseCase(makeUsers(user), makeHasher(false), tokens);

    const first = await captureError(() => unknownEmail.execute({ email: 'a@b.c', password: 'x' }));
    const second = await captureError(() =>
      wrongPassword.execute({ email: 'a@b.c', password: 'x' }),
    );

    expect(first).toBeInstanceOf(UnauthorizedError);
    expect(second).toBeInstanceOf(UnauthorizedError);
    // Identical message: the response must not reveal whether the account exists.
    expect(first.message).toBe(second.message);
    expect(first.message).toBe('Invalid credentials');
  });

  it('looks the user up with a normalised e-mail', async () => {
    const users = makeUsers(user);
    const useCase = new AuthenticateUserUseCase(users, makeHasher(true), tokens);

    await useCase.execute({ email: '  A@B.C ', password: 'secret123' });

    expect(users.findByEmail).toHaveBeenCalledWith('a@b.c');
  });

  it('still hashes a comparison for an unknown user, to keep timing uniform', async () => {
    const hasher = makeHasher(false);
    const useCase = new AuthenticateUserUseCase(makeUsers(null), hasher, tokens);

    await expect(useCase.execute({ email: 'a@b.c', password: 'x' })).rejects.toThrow(
      UnauthorizedError,
    );
    expect(hasher.compare).toHaveBeenCalled();
  });
});
