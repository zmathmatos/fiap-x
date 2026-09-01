import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { httpRequestDuration } from '../../../infrastructure/metrics/registry';

/** Times every request, labelled by the route pattern rather than the raw path. */
export function metricsMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const stop = httpRequestDuration.startTimer();

    res.on('finish', () => {
      stop({
        method: req.method,
        // `req.route` keeps ids out of the label, which would otherwise explode
        // cardinality with one time series per video.
        route: req.route?.path ?? 'unknown',
        status: String(res.statusCode),
      });
    });

    next();
  };
}
