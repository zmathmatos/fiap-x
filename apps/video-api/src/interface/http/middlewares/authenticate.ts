import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedError } from '@fiapx/shared';
import type { TokenService } from '../../../domain/ports/token-service';

export interface AuthContext {
  userId: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    correlationId?: string;
  }
}

const BEARER = /^Bearer (.+)$/i;

export function authenticate(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const match = BEARER.exec(req.headers.authorization ?? '');

    if (!match?.[1]) {
      next(new UnauthorizedError('Informe um token de acesso.'));
      return;
    }

    try {
      const payload = tokens.verify(match[1]);
      req.auth = { userId: payload.sub, email: payload.email };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Reads the auth context, throwing if the route was mounted without `authenticate`. */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new UnauthorizedError('Informe um token de acesso.');
  }
  return req.auth;
}
