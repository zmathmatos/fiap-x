import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../../domain/ports/password-hasher';

const COST = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
