/**
 * Backoff ladder for failed deliveries: 30s, then 2min, then 10min.
 * After the last rung the message goes to the dead letter queue.
 */
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const;

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

/**
 * @param attempt zero-based number of failures so far
 * @returns milliseconds to wait before the next try, or `null` when exhausted
 */
export function nextRetryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null;
}

export interface ExchangeSpec {
  name: string;
  type: 'topic';
  durable: true;
}

export interface QueueSpec {
  name: string;
  durable: true;
  args?: Record<string, string | number>;
}

export interface BindingSpec {
  queue: string;
  exchange: string;
  routingKey: string;
}

export interface TopologyPlan {
  exchanges: ExchangeSpec[];
  queues: QueueSpec[];
  bindings: BindingSpec[];
}

export function retryExchangeName(exchange: string, delayMs: number): string {
  return `${exchange}.retry.${delayMs}`;
}

export function retryQueueName(exchange: string, delayMs: number): string {
  return `${exchange}.retry.${delayMs}`;
}

export function deadLetterExchangeName(exchange: string): string {
  return `${exchange}.dlx`;
}

export function deadLetterQueueName(exchange: string): string {
  return `${exchange}.dlq`;
}

/**
 * Describes the exchanges, queues and bindings the platform needs.
 *
 * A failed message is republished — with its original routing key — to the retry
 * exchange of the next rung. It lands in the queue whose TTL matches that delay, sits
 * there, and is then dead-lettered back to the main exchange, which redelivers it to
 * the original consumer. No timers in application code.
 */
export function buildTopology(exchange: string): TopologyPlan {
  const dlx = deadLetterExchangeName(exchange);
  const dlq = deadLetterQueueName(exchange);

  const queues: QueueSpec[] = RETRY_DELAYS_MS.map((delay) => ({
    name: retryQueueName(exchange, delay),
    durable: true,
    args: {
      'x-message-ttl': delay,
      'x-dead-letter-exchange': exchange,
    },
  }));
  queues.push({ name: dlq, durable: true });

  const bindings: BindingSpec[] = RETRY_DELAYS_MS.map((delay) => ({
    queue: retryQueueName(exchange, delay),
    exchange: retryExchangeName(exchange, delay),
    routingKey: '#',
  }));
  bindings.push({ queue: dlq, exchange: dlx, routingKey: '#' });

  return {
    exchanges: [
      { name: exchange, type: 'topic', durable: true },
      ...RETRY_DELAYS_MS.map((delay) => ({
        name: retryExchangeName(exchange, delay),
        type: 'topic' as const,
        durable: true as const,
      })),
      { name: dlx, type: 'topic', durable: true },
    ],
    queues,
    bindings,
  };
}
