import { ValidationError } from '@fiapx/shared';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertValidEmail(email: string): void {
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Informe um e-mail válido.');
  }
}
