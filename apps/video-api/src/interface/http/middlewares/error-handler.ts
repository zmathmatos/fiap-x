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

    logger.error(
      { err: error, path: req.path, correlationId: req.correlationId },
      'unhandled error',
    );
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' },
    });
  };
}
