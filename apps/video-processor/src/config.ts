export interface ProcessorConfig {
  nodeEnv: string;
  logLevel: string;
  healthPort: number;
  prefetch: number;
  redisUrl: string;
  rabbitmqUrl: string;
  rabbitmqExchange: string;
  ffmpegPath: string;
  ffprobePath: string;
  storage: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    bucketRaw: string;
    bucketZips: string;
  };
}

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(env: Env, key: string, fallback: string): string {
  const value = env[key];
  return value === undefined || value.trim() === '' ? fallback : value;
}

function integer(env: Env, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

export function loadConfig(env: Env = process.env): ProcessorConfig {
  return {
    nodeEnv: optional(env, 'NODE_ENV', 'development'),
    logLevel: optional(env, 'LOG_LEVEL', 'info'),
    healthPort: integer(env, 'PROCESSOR_HEALTH_PORT', 9100),
    // One video at a time per replica: ffmpeg already saturates the CPU it is
    // given, so pulling a second message would only make both slower. Scale out
    // with replicas, not with prefetch.
    prefetch: integer(env, 'PROCESSOR_PREFETCH', 1),
    redisUrl: optional(env, 'REDIS_URL', 'redis://localhost:6379'),
    rabbitmqUrl: optional(env, 'RABBITMQ_URL', 'amqp://localhost:5672'),
    rabbitmqExchange: optional(env, 'RABBITMQ_EXCHANGE', 'video-events'),
    ffmpegPath: optional(env, 'FFMPEG_PATH', 'ffmpeg'),
    ffprobePath: optional(env, 'FFPROBE_PATH', 'ffprobe'),
    storage: {
      endpoint: optional(env, 'STORAGE_ENDPOINT', 'http://localhost:9000'),
      region: optional(env, 'STORAGE_REGION', 'us-east-1'),
      accessKeyId: required(env, 'STORAGE_ACCESS_KEY'),
      secretAccessKey: required(env, 'STORAGE_SECRET_KEY'),
      forcePathStyle: optional(env, 'STORAGE_FORCE_PATH_STYLE', 'true') === 'true',
      bucketRaw: optional(env, 'STORAGE_BUCKET_RAW', 'fiapx-raw'),
      bucketZips: optional(env, 'STORAGE_BUCKET_ZIPS', 'fiapx-zips'),
    },
  };
}
