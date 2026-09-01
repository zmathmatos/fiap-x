import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Gives every request a correlation id and echoes it back.
 *
 * The id is carried into the event envelope on publish, which is what makes it
 * possible to follow one upload through the API, the worker and the notifier.
 */
export function requestContext(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.headers[CORRELATION_HEADER];
    const correlationId = typeof incoming === 'string' && incoming ? incoming : randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    next();
  };
}
