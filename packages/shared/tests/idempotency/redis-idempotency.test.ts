import { createRedisIdempotencyStore } from '../../src/idempotency';

type RedisStub = { set: jest.Mock; exists: jest.Mock };

function redisStub(overrides: Partial<RedisStub> = {}): RedisStub {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('redis idempotency store', () => {
  it('returns true the first time and false afterwards', async () => {
    const redis = redisStub({
      set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
    });
    const store = createRedisIdempotencyStore(redis);

    await expect(store.markProcessed('evt-1')).resolves.toBe(true);
    await expect(store.markProcessed('evt-1')).resolves.toBe(false);
    expect(redis.set).toHaveBeenCalledWith('idem:evt-1', '1', 'EX', 86_400, 'NX');
  });

  it('honours a custom prefix and ttl', async () => {
    const redis = redisStub();
    const store = createRedisIdempotencyStore(redis, { prefix: 'api', ttlSeconds: 60 });

    await store.markProcessed('evt-2');

    expect(redis.set).toHaveBeenCalledWith('api:evt-2', '1', 'EX', 60, 'NX');
  });

  it('lets a redis failure surface so the message is retried rather than silently dropped', async () => {
    const redis = redisStub({ set: jest.fn().mockRejectedValue(new Error('redis down')) });
    const store = createRedisIdempotencyStore(redis);

    await expect(store.markProcessed('evt-3')).rejects.toThrow('redis down');
  });

  it('reports an event as processed only when the key is already there', async () => {
    const redis = redisStub({ exists: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1) });
    const store = createRedisIdempotencyStore(redis, { prefix: 'api' });

    await expect(store.wasProcessed('evt-4')).resolves.toBe(false);
    await expect(store.wasProcessed('evt-4')).resolves.toBe(true);
    expect(redis.exists).toHaveBeenCalledWith('api:evt-4');
  });
});
