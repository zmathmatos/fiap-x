import type { Request, RequestHandler, Response } from 'express';
import { asyncHandler } from '../async-handler';
import type { MetricsExporter } from '../../../application/ports/metrics';

export interface HealthChecks {
  postgres(): Promise<boolean>;
  rabbitmq(): Promise<boolean>;
  storage(): Promise<boolean>;
  redis(): Promise<boolean>;
}

export class HealthController {
  constructor(
    private readonly checks: HealthChecks,
    private readonly metricsExporter: MetricsExporter,
  ) {}

  /** Liveness: answers as long as the process is running. Never touches a dependency. */
  live = (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
  };

  /** Readiness: only reports ready when every dependency answers. */
  ready: RequestHandler = asyncHandler(async (_req, res) => {
    const [postgres, rabbitmq, storage, redis] = await Promise.all([
      this.checks.postgres(),
      this.checks.rabbitmq(),
      this.checks.storage(),
      this.checks.redis(),
    ]);

    const checks = { postgres, rabbitmq, storage, redis };
    const healthy = Object.values(checks).every(Boolean);

    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
  });

  metrics: RequestHandler = asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', this.metricsExporter.contentType);
    res.status(200).send(await this.metricsExporter.render());
  });
}
