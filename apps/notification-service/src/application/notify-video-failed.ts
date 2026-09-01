import {
  ROUTING_KEYS,
  type EventEnvelope,
  type IdempotencyStore,
  type Logger,
  type VideoFailedPayload,
} from '@fiapx/shared';
import type { Mailer } from '../domain/ports/mailer';
import { renderFailureEmail } from './templates/failure';

export interface NotifyDeps {
  mailer: Mailer;
  idempotency: IdempotencyStore;
  config: { appUrl: string };
  logger: Logger;
}

export class NotifyVideoFailedUseCase {
  constructor(private readonly deps: NotifyDeps) {}

  async execute(envelope: EventEnvelope<unknown>): Promise<void> {
    if (envelope.eventType !== ROUTING_KEYS.VIDEO_FAILED) return;

    const payload = envelope.payload as VideoFailedPayload;
    if (!payload.userEmail) {
      this.deps.logger.warn({ videoId: payload.videoId }, 'failure event carries no recipient');
      return;
    }

    if (!(await this.deps.idempotency.markProcessed(envelope.eventId))) return;

    const mail = renderFailureEmail({
      originalName: payload.originalName,
      reason: payload.reason,
      appUrl: this.deps.config.appUrl,
      videoId: payload.videoId,
    });

    // A send failure is deliberately not caught: the consumer puts the message on
    // the retry ladder, so a temporary SMTP outage does not lose the notification.
    await this.deps.mailer.send({ to: payload.userEmail, ...mail });

    this.deps.logger.info(
      { videoId: payload.videoId, correlationId: envelope.correlationId },
      'failure e-mail sent',
    );
  }
}
