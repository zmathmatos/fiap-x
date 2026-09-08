import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>;

/**
 * Sends a rejected handler into Express's error pipeline.
 *
 * Express 4 ignores a returned promise, so without this every handler would need
 * its own `try { … } catch (error) { next(error) }`.
 */
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}
