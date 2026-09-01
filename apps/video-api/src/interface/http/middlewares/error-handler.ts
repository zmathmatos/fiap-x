import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AppError, type Logger } from '@fiapx/shared';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof AppError) {
      // Expected failures are part of the contract: log at info, answer cleanly.
      logger.info(
        { code: error.code, path: req.path, correlationId: req.correlationId },
        error.message,
      );
      res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }

    // Express middleware (body-parser and friends) throws http-errors: those
    // already carry the right status and a message meant for the client. Without
    // this, malformed JSON would answer 500 and pollute the logs with a false
    // "unhandled error".
    const httpError = error as { statusCode?: unknown; expose?: unknown; message?: unknown };
    if (
      typeof httpError.statusCode === 'number' &&
      httpError.statusCode >= 400 &&
      httpError.statusCode < 500 &&
      httpError.expose === true
    ) {
      logger.info(
        { status: httpError.statusCode, path: req.path, correlationId: req.correlationId },
        'malformed request',
      );
      res.status(httpError.statusCode).json({
        error: {
          code: 'BAD_REQUEST',
          message:
            typeof httpError.message === 'string' ? httpError.message : 'Requisição inválida.',
        },
      });
      return;
    }

    logger.error(
      { err: error, path: req.path, correlationId: req.correlationId },
      'unhandled error',
    );
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' },
    });
  };
}
