import Redis from 'ioredis';
import {
  RabbitConnection,
  createLogger,
  createObjectStorage,
  createRedisIdempotencyStore,
  createRedisProgressStore,
  type Logger,
} from '@fiapx/shared';
import type { ProcessorConfig } from './config';
import { ProcessVideoUseCase } from './application/process-video';
import { FfmpegFrameExtractor } from './infrastructure/ffmpeg/ffmpeg-frame-extractor';
import { NodeZipArchiver } from './infrastructure/archive/zip-archiver';
import { metricsExporter, processingMetrics } from './infrastructure/metrics';
import { workspaceFactory } from './infrastructure/workspace';
import type { MetricsExporter } from './domain/ports/metrics-exporter';

export interface Container {
  logger: Logger;
  rabbit: RabbitConnection;
  metricsExporter: MetricsExporter;
  processVideo: ProcessVideoUseCase;
  isReady(): boolean;
  shutdown(): Promise<void>;
}

/** Wires every concrete adapter once, at boot. Nothing else constructs dependencies. */
export async function buildContainer(config: ProcessorConfig): Promise<Container> {
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
    progress: createRedisProgressStore(redis),
    workspace: workspaceFactory,
    metrics: processingMetrics,
    logger,
    config: { bucketRaw: config.storage.bucketRaw, bucketZips: config.storage.bucketZips },
  });

  return {
    logger,
    rabbit,
    metricsExporter,
    processVideo,
    isReady: () => rabbit.isHealthy(),
    async shutdown() {
      await rabbit.close().catch(() => undefined);
      redis.disconnect();
    },
  };
}
