export interface NotificationConfig {
  nodeEnv: string;
  logLevel: string;
  healthPort: number;
  redisUrl: string;
  rabbitmqUrl: string;
  rabbitmqExchange: string;
  appUrl: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
}

type Env = Record<string, string | undefined>;

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

export function loadConfig(env: Env = process.env): NotificationConfig {
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD?.trim();

  return {
    nodeEnv: optional(env, 'NODE_ENV', 'development'),
    logLevel: optional(env, 'LOG_LEVEL', 'info'),
    healthPort: integer(env, 'NOTIFICATION_HEALTH_PORT', 9101),
    redisUrl: optional(env, 'REDIS_URL', 'redis://localhost:6379'),
    rabbitmqUrl: optional(env, 'RABBITMQ_URL', 'amqp://localhost:5672'),
    rabbitmqExchange: optional(env, 'RABBITMQ_EXCHANGE', 'video-events'),
    appUrl: optional(env, 'APP_PUBLIC_URL', 'http://localhost:8080'),
    smtp: {
      host: optional(env, 'SMTP_HOST', 'localhost'),
      port: integer(env, 'SMTP_PORT', 1025),
      secure: optional(env, 'SMTP_SECURE', 'false') === 'true',
      user: user || undefined,
      password: password || undefined,
      from: optional(env, 'SMTP_FROM', 'FIAP X <no-reply@fiapx.local>'),
    },
  };
}
