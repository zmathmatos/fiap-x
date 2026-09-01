import Redis from 'ioredis';
import {
  RabbitConnection,
  ROUTING_KEYS,
  createLogger,
  createObjectStorage,
  createRedisIdempotencyStore,
} from '@fiapx/shared';
import { loadConfig } from './config';
import { ProcessVideoUseCase } from './application/process-video';
import { FfmpegFrameExtractor } from './infrastructure/ffmpeg/ffmpeg-frame-extractor';
import { NodeZipArchiver } from './infrastructure/archive/zip-archiver';
import { workspaceFactory } from './infrastructure/workspace';
import { startHealthServer } from './interface/health-server';

export const WORK_QUEUE = 'video-processor.uploads';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('video-processor');

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  const rabbit = await RabbitConnection.connect(config.rabbitmqUrl, logger);
  await rabbit.assertTopology(config.rabbitmqExchange);

  const storage = createObjectStorage({
    endpoint: config.storage.endpoint,
    region: config.storage.region,
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
    forcePathStyle: config.storage.forcePathStyle,
  });
  await storage.ensureBuckets([config.storage.bucketRaw, config.storage.bucketZips]);

  const processVideo = new ProcessVideoUseCase({
    storage,
    extractor: new FfmpegFrameExtractor(
      { ffmpegPath: config.ffmpegPath, ffprobePath: config.ffprobePath },
      logger,
    ),
    zipArchiver: new NodeZipArchiver(),
    publisher: rabbit.createPublisher(config.rabbitmqExchange),
    idempotency: createRedisIdempotencyStore(redis, { prefix: 'processor' }),
    workspace: workspaceFactory,
    logger,
    config: { bucketRaw: config.storage.bucketRaw, bucketZips: config.storage.bucketZips },
  });

  await rabbit.consume({
    queue: WORK_QUEUE,
    exchange: config.rabbitmqExchange,
    routingKeys: [ROUTING_KEYS.VIDEO_UPLOADED],
    prefetch: config.prefetch,
    handler: (envelope, attempt) => processVideo.execute(envelope, attempt),
  });

  const server = startHealthServer({
    port: config.healthPort,
    logger,
    isReady: () => rabbit.isHealthy(),
  });

  logger.info({ queue: WORK_QUEUE, prefetch: config.prefetch }, 'video-processor started');

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');

    // Closing the channel stops new deliveries; the message in flight keeps its
    // lock until it is acked, so a video being processed is never lost.
    void rabbit
      .close()
      .catch(() => undefined)
      .then(() => {
        redis.disconnect();
        server.close(() => process.exit(0));
      });

    // Long enough for a large video to finish encoding before the pod is killed.
    setTimeout(() => process.exit(1), 110_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  process.stderr.write(`Failed to start video-processor: ${String(error)}\n`);
  process.exit(1);
});
