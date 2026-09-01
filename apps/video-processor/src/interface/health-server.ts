import express from 'express';
import type { Server } from 'node:http';
import type { Logger } from '@fiapx/shared';
import { registry } from '../infrastructure/metrics';

export interface HealthServerDeps {
  port: number;
  logger: Logger;
  isReady(): boolean;
}

/**
 * Minimal HTTP surface so Kubernetes can probe the worker and Prometheus can
 * scrape it. The worker has no public API beyond this.
 */
export function startHealthServer(deps: HealthServerDeps): Server {
  const app = express();

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', (_req, res) => {
    const ready = deps.isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'degraded' });
  });

  app.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    void registry.metrics().then((body) => res.status(200).send(body));
  });

  return app.listen(deps.port, () => {
    deps.logger.info({ port: deps.port }, 'processor health server listening');
  });
}
