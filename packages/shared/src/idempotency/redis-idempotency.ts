export interface IdempotencyStore {
  wasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<boolean>;
}

/** The Redis commands this store needs, so tests can pass a stub. */
export interface RedisIdempotencyClient {
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
  exists(key: string): Promise<number>;
}

export interface IdempotencyOptions {
  prefix?: string;
  ttlSeconds?: number;
}

const DEFAULT_PREFIX = 'idem';
const DEFAULT_TTL_SECONDS = 86_400;

export function createRedisIdempotencyStore(
  redis: RedisIdempotencyClient,
  options: IdempotencyOptions = {},
): IdempotencyStore {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const keyOf = (eventId: string): string => `${prefix}:${eventId}`;

  return {
    // A Redis failure is deliberately not swallowed — better to retry the message
    // than to act twice because we could not check.
    async wasProcessed(eventId: string): Promise<boolean> {
      return (await redis.exists(keyOf(eventId))) === 1;
    },

    async markProcessed(eventId: string): Promise<boolean> {
      // SET NX is atomic: exactly one caller can win the key, even across replicas.
      const result = await redis.set(keyOf(eventId), '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    },
  };
}
