import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@fiapx/shared';
import type { RegisterUserUseCase } from '../../../application/use-cases/register-user';
import type { AuthenticateUserUseCase } from '../../../application/use-cases/authenticate-user';
import type { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user';
import { requireAuth } from '../middlewares/authenticate';

function readString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== 'string') {
    throw new ValidationError(`O campo "${field}" é obrigatório.`);
  }
  return value;
}

export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticateUser: AuthenticateUserUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registerUser.execute({
        name: readString(req.body, 'name'),
        email: readString(req.body, 'email'),
        password: readString(req.body, 'password'),
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authenticateUser.execute({
        email: readString(req.body, 'email'),
        password: readString(req.body, 'password'),
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = requireAuth(req);
      res.status(200).json(await this.getCurrentUser.execute(userId));
    } catch (error) {
      next(error);
    }
  };
}
