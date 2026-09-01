import { randomUUID } from 'node:crypto';
import { InvalidEventError } from '../errors';

/**
 * Every message on the bus carries this envelope.
 *
 * `eventId` doubles as the idempotency key: consumers record it before acting, so a
 * redelivery after a crash is a no-op. `correlationId` is copied from the event that
 * caused this one, which is what lets a single upload be traced across all services.
 */
export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  correlationId: string;
  payload: T;
}

const REQUIRED_FIELDS = ['eventId', 'eventType', 'occurredAt', 'correlationId'] as const;

export function createEnvelope<T>(
  eventType: string,
  payload: T,
  correlationId: string = randomUUID(),
): EventEnvelope<T> {
  return {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload,
  };
}

export function parseEnvelope<T>(raw: Buffer | string): EventEnvelope<T> {
  let candidate: unknown;

  try {
    candidate = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    throw new InvalidEventError('Event body is not valid JSON');
  }

  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new InvalidEventError('Event body is not an object');
  }

  const envelope = candidate as Partial<EventEnvelope<T>>;

  for (const field of REQUIRED_FIELDS) {
    if (typeof envelope[field] !== 'string') {
      throw new InvalidEventError(`Event envelope is missing "${field}"`);
    }
  }

  if (envelope.payload === undefined) {
    throw new InvalidEventError('Event envelope is missing "payload"');
  }

  return envelope as EventEnvelope<T>;
}
