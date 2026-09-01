import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@fiapx/shared';
import type { TokenPayload, TokenService } from '../../domain/ports/token-service';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign({ email: payload.email }, this.secret, {
      subject: payload.sub,
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
    } as jwt.SignOptions);
  }

  verify(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] });

      if (typeof decoded === 'string' || !decoded.sub || typeof decoded.email !== 'string') {
        throw new UnauthorizedError('Token inválido.');
      }
      return { sub: decoded.sub, email: decoded.email };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Sessão expirada ou inválida.');
    }
  }
}
