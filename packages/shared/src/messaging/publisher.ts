import type { ConfirmChannel } from 'amqplib';
import { createEnvelope, type EventEnvelope } from '../events';

export interface EventPublisher {
  publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void>;
}

/**
 * Publishes with publisher confirms: the promise settles only after the broker
 * has acknowledged the message. Without this an upload could be accepted while
 * the event silently vanished during a broker restart.
 */
export function createPublisher(channel: ConfirmChannel, exchange: string): EventPublisher {
  return {
    publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void> {
      const envelope: EventEnvelope<T> = createEnvelope(routingKey, payload, correlationId);
      const body = Buffer.from(JSON.stringify(envelope), 'utf8');

      return new Promise<void>((resolve, reject) => {
        channel.publish(
          exchange,
          routingKey,
          body,
          {
            persistent: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            messageId: envelope.eventId,
            correlationId: envelope.correlationId,
            timestamp: Date.parse(envelope.occurredAt),
            type: envelope.eventType,
          },
          (err) => (err ? reject(err) : resolve()),
        );
      });
    },
  };
}
