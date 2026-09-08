import Redis from 'ioredis';
import {
  RabbitConnection,
  createLogger,
  createRedisIdempotencyStore,
  type Logger,
} from '@fiapx/shared';
import type { NotificationConfig } from './config';
import { NotificationRouter } from './application/notification-router';
import { NotifyVideoFailedUseCase } from './application/notify-video-failed';
import { NotifyVideoProcessedUseCase } from './application/notify-video-processed';
import { NodemailerMailer } from './infrastructure/nodemailer-mailer';
import { metricsExporter, notificationMetrics } from './infrastructure/metrics';
import type { MetricsExporter } from './domain/ports/metrics-exporter';

export interface Container {
  logger: Logger;
  rabbit: RabbitConnection;
  metricsExporter: MetricsExporter;
  router: NotificationRouter;
  isReady(): boolean;
  shutdown(): Promise<void>;
}

/** Wires every concrete adapter once, at boot. Nothing else constructs dependencies. */
export async function buildContainer(config: NotificationConfig): Promise<Container> {
  const logger = createLogger('notification-service');

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  const rabbit = await RabbitConnection.connect(config.rabbitmqUrl, logger);
  await rabbit.assertTopology(config.rabbitmqExchange);

  const deps = {
    mailer: new NodemailerMailer(config.smtp, logger),
    idempotency: createRedisIdempotencyStore(redis, { prefix: 'notification' }),
    metrics: notificationMetrics,
    config: { appUrl: config.appUrl },
    logger,
  };

  return {
    logger,
    rabbit,
    metricsExporter,
    router: new NotificationRouter([
      new NotifyVideoFailedUseCase(deps),
      new NotifyVideoProcessedUseCase(deps),
    ]),
    isReady: () => rabbit.isHealthy(),
    async shutdown() {
      await rabbit.close().catch(() => undefined);
      redis.disconnect();
    },
  };
}
