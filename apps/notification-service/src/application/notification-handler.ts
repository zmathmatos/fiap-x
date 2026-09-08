import type { EventEnvelope, IdempotencyStore, Logger } from '@fiapx/shared';
import type { Mailer } from '../domain/ports/mailer';
import type { NotificationMetrics } from '../domain/ports/notification-metrics';

export interface NotifyDeps {
  mailer: Mailer;
  idempotency: IdempotencyStore;
  metrics: NotificationMetrics;
  config: { appUrl: string };
  logger: Logger;
}

/** One event type, one e-mail. Handlers declare what they own; the router dispatches. */
export interface NotificationHandler {
  readonly eventType: string;
  execute(envelope: EventEnvelope<unknown>): Promise<void>;
}
