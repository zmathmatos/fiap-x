import 'reflect-metadata';
import { loadConfig } from './config';
import { buildContainer } from './container';
import { buildApp } from './app';
import { startVideoEventsConsumer } from './infrastructure/messaging/video-events-consumer';

async function main(): Promise<void> {
  const config = loadConfig();
  const container = await buildContainer(config);

  await startVideoEventsConsumer({
    connection: container.rabbit,
    exchange: config.rabbitmqExchange,
    applyProcessingEvent: container.applyProcessingEvent,
    logger: container.logger,
  });

  const app = buildApp({
    logger: container.logger,
    corsOrigin: config.corsOrigin,
    authController: container.authController,
    videoController: container.videoController,
    healthController: container.healthController,
    tokenService: container.tokenService,
  });

  const server = app.listen(config.port, () => {
    container.logger.info({ port: config.port }, 'video-api listening');
  });

  const shutdown = (signal: string): void => {
    container.logger.info({ signal }, 'shutting down');

    // Stop accepting connections first, then let in-flight requests finish before
    // closing the database and the broker.
    server.close(() => {
      void container.shutdown().then(() => process.exit(0));
    });

    setTimeout(() => process.exit(1), 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // The logger may not exist yet if config validation failed, so use stderr.
  process.stderr.write(`Failed to start video-api: ${String(error)}\n`);
  process.exit(1);
});
