import { loadConfig } from './config';
import { buildContainer } from './container';
import { startHealthServer } from './interface/health-server';

export const NOTIFICATION_QUEUE = 'notification.video-results';

const DRAIN_TIMEOUT_MS = 15_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const container = await buildContainer(config);
  const { logger, router } = container;

  await container.rabbit.consume({
    queue: NOTIFICATION_QUEUE,
    exchange: config.rabbitmqExchange,
    routingKeys: router.routingKeys,
    prefetch: 5,
    handler: (envelope) => router.dispatch(envelope),
  });

  const server = startHealthServer({
    port: config.healthPort,
    logger,
    metrics: container.metricsExporter,
    isReady: container.isReady,
  });

  logger.info({ queue: NOTIFICATION_QUEUE }, 'notification-service started');

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    void container.shutdown().then(() => server.close(() => process.exit(0)));
    setTimeout(() => process.exit(1), DRAIN_TIMEOUT_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  process.stderr.write(`Failed to start notification-service: ${String(error)}\n`);
  process.exit(1);
});
