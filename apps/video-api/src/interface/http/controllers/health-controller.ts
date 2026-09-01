import type { NextFunction, Request, Response } from 'express';
import { registry } from '../../../infrastructure/metrics/registry';

export interface HealthChecks {
  postgres(): Promise<boolean>;
  rabbitmq(): Promise<boolean>;
  storage(): Promise<boolean>;
  redis(): Promise<boolean>;
}

export class HealthController {
  constructor(private readonly checks: HealthChecks) {}

  /** Liveness: answers as long as the process is running. Never touches a dependency. */
  live = (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
  };

  /** Readiness: only reports ready when every dependency answers. */
  ready = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [postgres, rabbitmq, storage, redis] = await Promise.all([
        this.checks.postgres(),
        this.checks.rabbitmq(),
        this.checks.storage(),
        this.checks.redis(),
      ]);

      const checks = { postgres, rabbitmq, storage, redis };
      const healthy = Object.values(checks).every(Boolean);

      res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
    } catch (error) {
      next(error);
    }
  };

  metrics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Content-Type', registry.contentType);
      res.status(200).send(await registry.metrics());
    } catch (error) {
      next(error);
    }
  };
}
