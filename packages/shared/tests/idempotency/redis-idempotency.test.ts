import { createRedisIdempotencyStore } from '../../src/idempotency';

type RedisStub = { set: jest.Mock };

describe('redis idempotency store', () => {
  it('returns true the first time and false afterwards', async () => {
    const redis: RedisStub = {
      set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
    };
    const store = createRedisIdempotencyStore(redis);

    await expect(store.markProcessed('evt-1')).resolves.toBe(true);
    await expect(store.markProcessed('evt-1')).resolves.toBe(false);
    expect(redis.set).toHaveBeenCalledWith('idem:evt-1', '1', 'EX', 86_400, 'NX');
  });

  it('honours a custom prefix and ttl', async () => {
    const redis: RedisStub = { set: jest.fn().mockResolvedValue('OK') };
    const store = createRedisIdempotencyStore(redis, { prefix: 'api', ttlSeconds: 60 });

    await store.markProcessed('evt-2');

    expect(redis.set).toHaveBeenCalledWith('api:evt-2', '1', 'EX', 60, 'NX');
  });

  it('lets a redis failure surface so the message is retried rather than silently dropped', async () => {
    const redis: RedisStub = { set: jest.fn().mockRejectedValue(new Error('redis down')) };
    const store = createRedisIdempotencyStore(redis);

    await expect(store.markProcessed('evt-3')).rejects.toThrow('redis down');
  });
});
