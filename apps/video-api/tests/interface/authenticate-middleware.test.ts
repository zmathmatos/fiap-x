import type { Request, Response } from 'express';
import { UnauthorizedError } from '@fiapx/shared';
import { authenticate, requireAuth } from '../../src/interface/http/middlewares/authenticate';
import type { TokenService } from '../../src/domain/ports/token-service';

const tokens: TokenService = {
  sign: () => 'signed',
  verify: (token) => {
    if (token !== 'good-token') throw new UnauthorizedError('Sessão expirada ou inválida.');
    return { sub: 'u1', email: 'a@b.c' };
  },
};

function run(authorization?: string): { req: Request; next: jest.Mock } {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const next = jest.fn();
  authenticate(tokens)(req, {} as Response, next);
  return { req, next };
}

describe('authenticate middleware', () => {
  it('populates req.auth for a valid bearer token', () => {
    const { req, next } = run('Bearer good-token');

    expect(req.auth).toEqual({ userId: 'u1', email: 'a@b.c' });
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts a lowercase bearer scheme', () => {
    const { req } = run('bearer good-token');
    expect(req.auth).toEqual({ userId: 'u1', email: 'a@b.c' });
  });

  it('rejects a request with no authorization header', () => {
    const { next } = run();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a header that is not a bearer token', () => {
    const { next } = run('Basic abc123');
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(UnauthorizedError);
  });

  it('forwards the verification failure', () => {
    const { req, next } = run('Bearer tampered');

    expect(req.auth).toBeUndefined();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(UnauthorizedError);
  });
});

describe('requireAuth', () => {
  it('returns the context when present', () => {
    const req = { auth: { userId: 'u1', email: 'a@b.c' } } as Request;
    expect(requireAuth(req)).toEqual({ userId: 'u1', email: 'a@b.c' });
  });

  it('throws when the route was mounted without the middleware', () => {
    expect(() => requireAuth({} as Request)).toThrow(UnauthorizedError);
  });
});
