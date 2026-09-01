export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

export interface Config {
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  maxUploadBytes: number;
  frameIntervalSeconds: number;
  database: DatabaseConfig;
  redisUrl: string;
  rabbitmqUrl: string;
  rabbitmqExchange: string;
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

/**
 * Reads and validates configuration once, at boot.
 *
 * Failing here is deliberate: a container that starts with a missing JWT secret
 * and only discovers it on the first login is far worse than one that refuses to
 * start at all.
 */
export function loadConfig(env: Env = process.env): Config {
  return {
    nodeEnv: optional(env, 'NODE_ENV', 'development'),
    port: integer(env, 'API_PORT', 3000),
    logLevel: optional(env, 'LOG_LEVEL', 'info'),
    corsOrigin: optional(env, 'CORS_ORIGIN', '*'),
    jwtSecret: required(env, 'JWT_SECRET'),
    jwtExpiresIn: optional(env, 'JWT_EXPIRES_IN', '8h'),
    maxUploadBytes: integer(env, 'MAX_UPLOAD_BYTES', 524_288_000),
    frameIntervalSeconds: integer(env, 'FRAME_INTERVAL_SECONDS', 20),
    database: {
      host: optional(env, 'DB_HOST', 'localhost'),
      port: integer(env, 'DB_PORT', 5432),
      database: optional(env, 'DB_NAME', 'fiapx'),
      user: required(env, 'DB_USER'),
      password: required(env, 'DB_PASSWORD'),
      schema: optional(env, 'DB_SCHEMA', 'video'),
    },
    redisUrl: optional(env, 'REDIS_URL', 'redis://localhost:6379'),
    rabbitmqUrl: optional(env, 'RABBITMQ_URL', 'amqp://localhost:5672'),
    rabbitmqExchange: optional(env, 'RABBITMQ_EXCHANGE', 'video-events'),
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
