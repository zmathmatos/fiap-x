import Redis from 'ioredis';
import {
  RabbitConnection,
  createLogger,
  createObjectStorage,
  createRedisIdempotencyStore,
  createRedisProgressStore,
  type Logger,
  type ObjectStorage,
} from '@fiapx/shared';
import type { DataSource } from 'typeorm';
import type { Config } from './config';
import { createDataSource } from './infrastructure/database/data-source';
import { metricsExporter, videoMetrics } from './infrastructure/metrics/registry';
import { withProgressFallback } from './infrastructure/progress/resilient-progress-store';
import { TypeOrmUserRepository } from './infrastructure/repositories/typeorm-user-repository';
import { TypeOrmVideoRepository } from './infrastructure/repositories/typeorm-video-repository';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/auth/jwt-token-service';
import { RegisterUserUseCase } from './application/use-cases/register-user';
import { AuthenticateUserUseCase } from './application/use-cases/authenticate-user';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user';
import { UploadVideoUseCase } from './application/use-cases/upload-video';
import { ListVideosUseCase } from './application/use-cases/list-videos';
import { GetVideoUseCase } from './application/use-cases/get-video';
import { RenameVideoUseCase } from './application/use-cases/rename-video';
import { GetVideoThumbnailUseCase } from './application/use-cases/get-video-thumbnail';
import { DownloadVideoZipUseCase } from './application/use-cases/download-video-zip';
import { ApplyProcessingEventUseCase } from './application/use-cases/apply-processing-event';
import { AuthController } from './interface/http/controllers/auth-controller';
import { VideoController } from './interface/http/controllers/video-controller';
import {
  HealthController,
  type HealthChecks,
} from './interface/http/controllers/health-controller';

export interface Container {
  logger: Logger;
  dataSource: DataSource;
  redis: Redis;
  rabbit: RabbitConnection;
  storage: ObjectStorage;
  authController: AuthController;
  videoController: VideoController;
  healthController: HealthController;
  tokenService: JwtTokenService;
  applyProcessingEvent: ApplyProcessingEventUseCase;
  shutdown(): Promise<void>;
}

/** A dependency is healthy when its probe resolves truthy; any throw means "no". */
async function reachable(probe: () => Promise<unknown>): Promise<boolean> {
  try {
    return (await probe()) !== false;
  } catch {
    return false;
  }
}

/** Wires every concrete adapter once, at boot. Nothing else constructs dependencies. */
export async function buildContainer(config: Config): Promise<Container> {
  const logger = createLogger('video-api');

  const dataSource = createDataSource(config.database);
  await dataSource.initialize();

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

  const users = new TypeOrmUserRepository(dataSource);
  const videos = new TypeOrmVideoRepository(dataSource);
  const hasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(config.jwtSecret, config.jwtExpiresIn);
  const publisher = rabbit.createPublisher(config.rabbitmqExchange);
  const idempotency = createRedisIdempotencyStore(redis, { prefix: 'video-api' });
  const progress = withProgressFallback(createRedisProgressStore(redis));

  const authController = new AuthController(
    new RegisterUserUseCase(users, hasher, tokenService),
    new AuthenticateUserUseCase(users, hasher, tokenService),
    new GetCurrentUserUseCase(users),
  );

  const videoController = new VideoController(
    {
      uploadVideo: new UploadVideoUseCase(videos, storage, publisher, {
        bucketRaw: config.storage.bucketRaw,
        defaultFrameIntervalSeconds: config.frameIntervalSeconds,
      }),
      listVideos: new ListVideosUseCase(videos, progress),
      getVideo: new GetVideoUseCase(videos, progress),
      downloadVideoZip: new DownloadVideoZipUseCase(videos, storage, {
        bucketZips: config.storage.bucketZips,
      }),
      renameVideo: new RenameVideoUseCase(videos),
      getVideoThumbnail: new GetVideoThumbnailUseCase(videos, storage, {
        bucketZips: config.storage.bucketZips,
      }),
    },
    { maxUploadBytes: config.maxUploadBytes },
    videoMetrics,
  );

  const healthChecks: HealthChecks = {
    postgres: () => reachable(() => dataSource.query('SELECT 1')),
    rabbitmq: async () => rabbit.isHealthy(),
    storage: () => storage.isHealthy(config.storage.bucketRaw),
    redis: () => reachable(async () => (await redis.ping()) === 'PONG'),
  };

  const healthController = new HealthController(healthChecks, metricsExporter);

  return {
    logger,
    dataSource,
    redis,
    rabbit,
    storage,
    authController,
    videoController,
    healthController,
    tokenService,
    applyProcessingEvent: new ApplyProcessingEventUseCase(videos, idempotency),
    async shutdown() {
      await rabbit.close().catch(() => undefined);
      await dataSource.destroy().catch(() => undefined);
      redis.disconnect();
    },
  };
}
