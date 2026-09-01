import express from 'express';
import Redis from 'ioredis';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';
import {
  RabbitConnection,
  ROUTING_KEYS,
  createLogger,
  createRedisIdempotencyStore,
} from '@fiapx/shared';
import { loadConfig } from './config';
import { NodemailerMailer } from './infrastructure/nodemailer-mailer';
import { NotifyVideoFailedUseCase } from './application/notify-video-failed';
import { NotifyVideoProcessedUseCase } from './application/notify-video-processed';

export const NOTIFICATION_QUEUE = 'notification.video-results';

const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'fiapx_notification_' });

const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'E-mails enviados',
  labelNames: ['kind'] as const,
  registers: [registry],
});

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('notification-service');

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  const rabbit = await RabbitConnection.connect(config.rabbitmqUrl, logger);
  await rabbit.assertTopology(config.rabbitmqExchange);

  const mailer = new NodemailerMailer(config.smtp, logger);
  const deps = {
    mailer,
    idempotency: createRedisIdempotencyStore(redis, { prefix: 'notification' }),
    config: { appUrl: config.appUrl },
    logger,
  };

  const notifyFailed = new NotifyVideoFailedUseCase(deps);
  const notifyProcessed = new NotifyVideoProcessedUseCase(deps);

  await rabbit.consume({
    queue: NOTIFICATION_QUEUE,
    exchange: config.rabbitmqExchange,
    routingKeys: [ROUTING_KEYS.VIDEO_FAILED, ROUTING_KEYS.VIDEO_PROCESSED],
    prefetch: 5,
    handler: async (envelope) => {
      await notifyFailed.execute(envelope);
      await notifyProcessed.execute(envelope);

      if (envelope.eventType === ROUTING_KEYS.VIDEO_FAILED) {
        notificationsSentTotal.inc({ kind: 'failure' });
      }
      if (envelope.eventType === ROUTING_KEYS.VIDEO_PROCESSED) {
        notificationsSentTotal.inc({ kind: 'success' });
      }
    },
  });

  const app = express();
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.get('/health/ready', (_req, res) => {
    const ready = rabbit.isHealthy();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'degraded' });
  });
  app.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    void registry.metrics().then((body) => res.status(200).send(body));
  });

  const server = app.listen(config.healthPort, () => {
    logger.info({ port: config.healthPort }, 'notification-service listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    void rabbit
      .close()
      .catch(() => undefined)
      .then(() => {
        redis.disconnect();
        server.close(() => process.exit(0));
      });
    setTimeout(() => process.exit(1), 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  process.stderr.write(`Failed to start notification-service: ${String(error)}\n`);
  process.exit(1);
});
