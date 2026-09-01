import Redis from 'ioredis';
import {
  RabbitConnection,
  createLogger,
  createObjectStorage,
  createRedisIdempotencyStore,
  type Logger,
  type ObjectStorage,
} from '@fiapx/shared';
import type { DataSource } from 'typeorm';
import type { Config } from './config';
import { createDataSource } from './infrastructure/database/data-source';
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
import { DownloadVideoZipUseCase } from './application/use-cases/download-video-zip';
import { ApplyProcessingEventUseCase } from './application/use-cases/apply-processing-event';
import { AuthController } from './interface/http/controllers/auth-controller';
import { VideoController } from './interface/http/controllers/video-controller';
import { HealthController } from './interface/http/controllers/health-controller';

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
      listVideos: new ListVideosUseCase(videos),
      getVideo: new GetVideoUseCase(videos),
      downloadVideoZip: new DownloadVideoZipUseCase(videos, storage, {
        bucketZips: config.storage.bucketZips,
      }),
    },
    { maxUploadBytes: config.maxUploadBytes },
  );

  const healthController = new HealthController({
    postgres: async () => {
      try {
        await dataSource.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    rabbitmq: async () => rabbit.isHealthy(),
    storage: async () => storage.isHealthy(config.storage.bucketRaw),
    redis: async () => {
      try {
        return (await redis.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
  });

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
