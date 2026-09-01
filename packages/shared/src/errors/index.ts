/**
 * Base class for every error the platform raises on purpose.
 *
 * `statusCode` and `code` travel with the error so the HTTP layer can translate a
 * domain failure into a response without knowing what the failure means.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid credentials') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
  }
}

/**
 * Raised when a message cannot be read as an event envelope. These are never
 * retried — a message that is not parseable now will not be parseable later.
 */
export class InvalidEventError extends AppError {
  constructor(message: string) {
    super(message, 422, 'INVALID_EVENT');
  }
}
