import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import type { Logger } from 'pino';
import { createPublisher, type EventPublisher } from './publisher';
import { handleDelivery, ATTEMPT_HEADER, type Delivery, type EventHandler } from './consumer';
import {
  buildTopology,
  nextRetryDelay,
  deadLetterExchangeName,
  retryExchangeName,
} from './topology';

export interface ConsumeOptions {
  queue: string;
  exchange: string;
  routingKeys: string[];
  prefetch?: number;
  handler: EventHandler;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Owns one AMQP connection and one confirm channel, re-establishing both when the
 * broker goes away. Registered consumers are replayed after every reconnect, so a
 * broker restart is invisible to callers.
 */
export class RabbitConnection {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private readonly consumers: ConsumeOptions[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private closing = false;

  private constructor(
    private readonly url: string,
    private readonly logger: Logger,
  ) {}

  static async connect(url: string, logger: Logger): Promise<RabbitConnection> {
    const instance = new RabbitConnection(url, logger);
    await instance.open();
    return instance;
  }

  private async open(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createConfirmChannel();
    this.backoffMs = INITIAL_BACKOFF_MS;

    this.connection.on('error', (err) => this.logger.error({ err }, 'amqp connection error'));
    this.connection.on('close', () => {
      if (this.closing) return;
      this.logger.warn('amqp connection closed, scheduling reconnect');
      this.channel = null;
      this.connection = null;
      this.scheduleReconnect();
    });

    this.logger.info('connected to rabbitmq');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.closing) return;

    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, delay);

    this.logger.info({ delayMs: delay }, 'reconnecting to rabbitmq');
  }

  private async reconnect(): Promise<void> {
    try {
      await this.open();
      const pending = [...this.consumers];
      this.consumers.length = 0;
      for (const options of pending) {
        await this.consume(options);
      }
      this.logger.info({ consumers: pending.length }, 'rabbitmq consumers restored');
    } catch (err) {
      this.logger.error({ err }, 'rabbitmq reconnect failed');
      this.scheduleReconnect();
    }
  }

  private requireChannel(): ConfirmChannel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }
    return this.channel;
  }

  isHealthy(): boolean {
    return this.channel !== null;
  }

  /** Declares every exchange, queue and binding the platform relies on. Idempotent. */
  async assertTopology(exchange: string): Promise<void> {
    const channel = this.requireChannel();
    const plan = buildTopology(exchange);

    for (const spec of plan.exchanges) {
      await channel.assertExchange(spec.name, spec.type, { durable: spec.durable });
    }
    for (const spec of plan.queues) {
      await channel.assertQueue(spec.name, { durable: spec.durable, arguments: spec.args });
    }
    for (const spec of plan.bindings) {
      await channel.bindQueue(spec.queue, spec.exchange, spec.routingKey);
    }
  }

  createPublisher(exchange: string): EventPublisher {
    return createPublisher(this.requireChannel(), exchange);
  }

  async consume(options: ConsumeOptions): Promise<void> {
    const channel = this.requireChannel();

    await channel.assertQueue(options.queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': deadLetterExchangeName(options.exchange) },
    });
    for (const routingKey of options.routingKeys) {
      await channel.bindQueue(options.queue, options.exchange, routingKey);
    }
    await channel.prefetch(options.prefetch ?? 1);

    await channel.consume(options.queue, (msg) => {
      if (!msg) return;
      void handleDelivery({
        delivery: msg,
        handler: options.handler,
        ack: () => channel.ack(msg),
        sendToRetry: (delivery, nextAttempt) =>
          this.sendToRetry(options.exchange, delivery, nextAttempt),
        logger: this.logger,
      });
    });

    this.consumers.push(options);
    this.logger.info(
      { queue: options.queue, routingKeys: options.routingKeys },
      'consumer registered',
    );
  }

  /**
   * Republishes a failed delivery onto the retry ladder, or onto the dead letter
   * exchange once the ladder is exhausted.
   */
  private sendToRetry(exchange: string, delivery: Delivery, nextAttempt: number): void {
    const channel = this.channel;
    if (!channel) {
      this.logger.error('cannot schedule retry: channel unavailable');
      return;
    }

    const delay = nextRetryDelay(nextAttempt - 1);
    const headers = { ...delivery.properties.headers, [ATTEMPT_HEADER]: nextAttempt };

    if (delay === null) {
      channel.publish(
        deadLetterExchangeName(exchange),
        delivery.fields.routingKey,
        delivery.content,
        { persistent: true, headers },
      );
      this.logger.error(
        { routingKey: delivery.fields.routingKey, attempt: nextAttempt },
        'retries exhausted, message sent to dead letter queue',
      );
      return;
    }

    channel.publish(
      retryExchangeName(exchange, delay),
      delivery.fields.routingKey,
      delivery.content,
      { persistent: true, headers },
    );
    this.logger.warn(
      { routingKey: delivery.fields.routingKey, attempt: nextAttempt, delayMs: delay },
      'message scheduled for retry',
    );
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.channel?.close();
      await this.connection?.close();
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }
}
