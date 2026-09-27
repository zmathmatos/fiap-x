import { AppError } from '@fiapx/shared';

/** The file cannot be decoded: retrying the same bytes fails the same way. */
export class UnprocessableVideoError extends AppError {
  constructor(message: string) {
    super(message, 422, 'UNPROCESSABLE_VIDEO');
  }
}
