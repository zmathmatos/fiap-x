/**
 * Records which events a consumer has already handled.
 *
 * RabbitMQ guarantees at-least-once delivery, so a worker that crashes after doing
 * its work but before acking will see the same message again. Every consumer calls
 * `markProcessed` first and skips the work when it returns `false`.
 */
export interface IdempotencyStore {
  markProcessed(eventId: string): Promise<boolean>;
}

/** The single Redis command this store needs, so tests can pass a stub. */
export interface RedisSetter {
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
}

export interface IdempotencyOptions {
  prefix?: string;
  ttlSeconds?: number;
}

const DEFAULT_PREFIX = 'idem';
const DEFAULT_TTL_SECONDS = 86_400;

export function createRedisIdempotencyStore(
  redis: RedisSetter,
  options: IdempotencyOptions = {},
): IdempotencyStore {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  return {
    async markProcessed(eventId: string): Promise<boolean> {
      // SET NX is atomic: exactly one caller can win the key, even across replicas.
      // A Redis failure is deliberately not swallowed — better to retry the message
      // than to skip work because we could not check.
      const result = await redis.set(`${prefix}:${eventId}`, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    },
  };
}
