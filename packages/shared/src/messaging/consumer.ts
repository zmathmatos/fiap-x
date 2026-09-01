import type { Logger } from 'pino';
import { parseEnvelope, type EventEnvelope } from '../events';
import { InvalidEventError } from '../errors';

/** The slice of an AMQP message this module actually needs. */
export interface Delivery {
  content: Buffer;
  properties: { headers?: Record<string, unknown> | undefined };
  fields: { routingKey: string };
}

export type EventHandler = (envelope: EventEnvelope<unknown>, attempt: number) => Promise<void>;

export interface HandleDeliveryContext {
  delivery: Delivery;
  handler: EventHandler;
  ack: () => void;
  sendToRetry: (delivery: Delivery, nextAttempt: number) => void;
  logger: Logger;
}

export const ATTEMPT_HEADER = 'x-attempt';

/**
 * Decides what happens to a single delivery. Kept free of amqplib so the policy
 * can be tested without a broker.
 *
 * The message is always acked. Failures are not nacked — they are republished to
 * the retry exchange, which is what gives us a delay without blocking the consumer
 * or spinning on an immediate redelivery loop.
 */
export async function handleDelivery(ctx: HandleDeliveryContext): Promise<void> {
  const attempt = Number(ctx.delivery.properties.headers?.[ATTEMPT_HEADER] ?? 0);

  let envelope: EventEnvelope<unknown>;
  try {
    envelope = parseEnvelope(ctx.delivery.content);
  } catch (error) {
    if (error instanceof InvalidEventError) {
      // Unparseable now means unparseable forever. Drop it rather than burn retries.
      ctx.logger.error(
        { err: error, routingKey: ctx.delivery.fields.routingKey },
        'dropping malformed event',
      );
      ctx.ack();
      return;
    }
    throw error;
  }

  try {
    await ctx.handler(envelope, attempt);
    ctx.ack();
  } catch (error) {
    ctx.logger.error(
      {
        err: error,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        correlationId: envelope.correlationId,
        attempt,
      },
      'event handler failed, scheduling retry',
    );
    ctx.sendToRetry(ctx.delivery, attempt + 1);
    ctx.ack();
  }
}
