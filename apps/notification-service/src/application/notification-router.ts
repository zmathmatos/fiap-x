import type { EventEnvelope } from '@fiapx/shared';
import type { NotificationHandler } from './notification-handler';

/**
 * Sends each event to the one handler that owns it.
 *
 * Adding a notification means registering a handler, not editing a dispatch chain
 * that every existing handler already runs through.
 */
export class NotificationRouter {
  private readonly handlers: Map<string, NotificationHandler>;

  constructor(handlers: readonly NotificationHandler[]) {
    this.handlers = new Map(handlers.map((handler) => [handler.eventType, handler]));
  }

  get routingKeys(): string[] {
    return [...this.handlers.keys()];
  }

  async dispatch(envelope: EventEnvelope<unknown>): Promise<void> {
    await this.handlers.get(envelope.eventType)?.execute(envelope);
  }
}
