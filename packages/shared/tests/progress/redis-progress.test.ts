import { createRedisProgressStore } from '../../src/progress';

type RedisStub = { set: jest.Mock; mget: jest.Mock };

function redisStub(overrides: Partial<RedisStub> = {}): RedisStub {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    mget: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('redis progress store', () => {
  it('writes the percent under a per-video key with a ttl', async () => {
    const redis = redisStub();
    const store = createRedisProgressStore(redis);

    await store.report('vid-1', 42);

    expect(redis.set).toHaveBeenCalledWith('progress:vid-1', '42', 'EX', 300);
  });

  it('honours a custom prefix and ttl', async () => {
    const redis = redisStub();
    const store = createRedisProgressStore(redis, { prefix: 'p', ttlSeconds: 60 });

    await store.report('vid-2', 10);

    expect(redis.set).toHaveBeenCalledWith('p:vid-2', '10', 'EX', 60);
  });

  it('clamps out-of-range percents so a bad probe cannot render a broken bar', async () => {
    const redis = redisStub();
    const store = createRedisProgressStore(redis);

    await store.report('vid-3', 140);
    await store.report('vid-4', -5);

    expect(redis.set).toHaveBeenNthCalledWith(1, 'progress:vid-3', '100', 'EX', 300);
    expect(redis.set).toHaveBeenNthCalledWith(2, 'progress:vid-4', '0', 'EX', 300);
  });

  it('rounds fractional percents to whole numbers', async () => {
    const redis = redisStub();
    const store = createRedisProgressStore(redis);

    await store.report('vid-5', 33.7);

    expect(redis.set).toHaveBeenCalledWith('progress:vid-5', '34', 'EX', 300);
  });

  it('reads many videos in one round trip and omits the ones with no progress', async () => {
    const redis = redisStub({ mget: jest.fn().mockResolvedValue(['12', null, '99']) });
    const store = createRedisProgressStore(redis);

    const result = await store.read(['a', 'b', 'c']);

    expect(redis.mget).toHaveBeenCalledWith(['progress:a', 'progress:b', 'progress:c']);
    expect(result).toEqual(
      new Map([
        ['a', 12],
        ['c', 99],
      ]),
    );
  });

  it('does not touch redis when asked for an empty list', async () => {
    const redis = redisStub();
    const store = createRedisProgressStore(redis);

    await expect(store.read([])).resolves.toEqual(new Map());
    expect(redis.mget).not.toHaveBeenCalled();
  });

  it('ignores values that are not numbers rather than reporting NaN', async () => {
    const redis = redisStub({ mget: jest.fn().mockResolvedValue(['oops']) });
    const store = createRedisProgressStore(redis);

    await expect(store.read(['a'])).resolves.toEqual(new Map());
  });
});
