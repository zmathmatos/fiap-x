import { ROUTING_KEYS } from '@fiapx/shared';
import { loadConfig } from './config';
import { buildContainer } from './container';
import { startHealthServer } from './interface/health-server';

export const WORK_QUEUE = 'video-processor.uploads';

/** Long enough for a large video to finish encoding before the pod is killed. */
const DRAIN_TIMEOUT_MS = 110_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const container = await buildContainer(config);
  const { logger } = container;

  await container.rabbit.consume({
    queue: WORK_QUEUE,
    exchange: config.rabbitmqExchange,
    routingKeys: [ROUTING_KEYS.VIDEO_UPLOADED],
    prefetch: config.prefetch,
    handler: (envelope, attempt) => container.processVideo.execute(envelope, attempt),
  });

  const server = startHealthServer({
    port: config.healthPort,
    logger,
    metrics: container.metricsExporter,
    isReady: container.isReady,
  });

  logger.info({ queue: WORK_QUEUE, prefetch: config.prefetch }, 'video-processor started');

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');

    // Closing the channel stops new deliveries; the message in flight keeps its
    // lock until it is acked, so a video being processed is never lost.
    void container.shutdown().then(() => server.close(() => process.exit(0)));

    setTimeout(() => process.exit(1), DRAIN_TIMEOUT_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  process.stderr.write(`Failed to start video-processor: ${String(error)}\n`);
  process.exit(1);
});
