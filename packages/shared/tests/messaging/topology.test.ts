import { buildTopology, nextRetryDelay, RETRY_DELAYS_MS } from '../../src/messaging/topology';

describe('buildTopology', () => {
  const plan = buildTopology('video-events');

  it('declares a durable topic exchange, one retry exchange per delay and the dlx', () => {
    expect(plan.exchanges).toEqual([
      { name: 'video-events', type: 'topic', durable: true },
      { name: 'video-events.retry.30000', type: 'topic', durable: true },
      { name: 'video-events.retry.120000', type: 'topic', durable: true },
      { name: 'video-events.retry.600000', type: 'topic', durable: true },
      { name: 'video-events.dlx', type: 'topic', durable: true },
    ]);
  });

  it('creates one retry queue per configured delay, dead-lettering back to the main exchange', () => {
    const retryQueues = plan.queues.filter((q) => q.name.startsWith('video-events.retry.'));

    expect(retryQueues).toHaveLength(RETRY_DELAYS_MS.length);
    expect(retryQueues[0]).toEqual({
      name: 'video-events.retry.30000',
      durable: true,
      args: {
        'x-message-ttl': 30_000,
        'x-dead-letter-exchange': 'video-events',
      },
    });
  });

  it('creates a dead letter queue bound to the dlx', () => {
    expect(plan.queues).toContainEqual({ name: 'video-events.dlq', durable: true });
    expect(plan.bindings).toContainEqual({
      queue: 'video-events.dlq',
      exchange: 'video-events.dlx',
      routingKey: '#',
    });
  });

  it('binds each retry queue to the exchange of its own delay, catching every key', () => {
    expect(plan.bindings).toContainEqual({
      queue: 'video-events.retry.120000',
      exchange: 'video-events.retry.120000',
      routingKey: '#',
    });
  });
});

describe('nextRetryDelay', () => {
  it('walks the backoff ladder', () => {
    expect(nextRetryDelay(0)).toBe(30_000);
    expect(nextRetryDelay(1)).toBe(120_000);
    expect(nextRetryDelay(2)).toBe(600_000);
  });

  it('returns null once retries are exhausted', () => {
    expect(nextRetryDelay(3)).toBeNull();
    expect(nextRetryDelay(99)).toBeNull();
  });
});
