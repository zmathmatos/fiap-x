import { RegisterUserUseCase } from '../../src/application/use-cases/register-user';
import { ValidationError } from '@fiapx/shared';
import { User } from '../../src/domain/entities/user';
import type { UserRepository } from '../../src/domain/ports/user-repository';
import type { PasswordHasher } from '../../src/domain/ports/password-hasher';
import type { TokenService } from '../../src/domain/ports/token-service';

const hasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  compare: async () => true,
};

const tokens: TokenService = {
  sign: (payload) => `token-for-${payload.sub}`,
  verify: () => ({ sub: 'u1', email: 'a@b.c' }),
};

function makeUsers(overrides: Partial<jest.Mocked<UserRepository>> = {}) {
  return {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(
      async (input) =>
        new User({
          id: 'u1',
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          createdAt: new Date('2026-09-01T12:00:00Z'),
        }),
    ),
    ...overrides,
  } as unknown as jest.Mocked<UserRepository>;
}

describe('RegisterUserUseCase', () => {
  it('rejects an e-mail that is already registered', async () => {
    const users = makeUsers({
      findByEmail: jest.fn().mockResolvedValue(
        new User({
          id: 'existing',
          name: 'A',
          email: 'a@b.c',
          passwordHash: 'x',
          createdAt: new Date(),
        }),
      ) as never,
    });
    const useCase = new RegisterUserUseCase(users, hasher, tokens);

    await expect(
      useCase.execute({ name: 'A', email: 'a@b.c', password: 'secret123' }),
    ).rejects.toThrow(ValidationError);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    const useCase = new RegisterUserUseCase(makeUsers(), hasher, tokens);

    await expect(useCase.execute({ name: 'A', email: 'a@b.c', password: 'short' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects a malformed e-mail', async () => {
    const useCase = new RegisterUserUseCase(makeUsers(), hasher, tokens);

    await expect(
      useCase.execute({ name: 'A', email: 'not-an-email', password: 'secret123' }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an empty name', async () => {
    const useCase = new RegisterUserUseCase(makeUsers(), hasher, tokens);

    await expect(
      useCase.execute({ name: '   ', email: 'a@b.c', password: 'secret123' }),
    ).rejects.toThrow(ValidationError);
  });

  it('stores the hash, never the plain password', async () => {
    const users = makeUsers();
    const useCase = new RegisterUserUseCase(users, hasher, tokens);

    await useCase.execute({ name: 'A', email: 'a@b.c', password: 'secret123' });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed:secret123' }),
    );
    // The repository must never receive the plain password under any key.
    expect(users.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ password: expect.anything() }),
    );
  });

  it('normalises the e-mail to lower case and trims it', async () => {
    const users = makeUsers();
    const useCase = new RegisterUserUseCase(users, hasher, tokens);

    await useCase.execute({ name: '  Ana  ', email: '  A@B.C  ', password: 'secret123' });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.c', name: 'Ana' }),
    );
  });

  it('returns the public user plus a token', async () => {
    const useCase = new RegisterUserUseCase(makeUsers(), hasher, tokens);

    const result = await useCase.execute({ name: 'A', email: 'a@b.c', password: 'secret123' });

    expect(result).toEqual({
      user: { id: 'u1', name: 'A', email: 'a@b.c', createdAt: '2026-09-01T12:00:00.000Z' },
      token: 'token-for-u1',
    });
  });
});
