import { ROUTING_KEYS, type EventEnvelope, type VideoFailedPayload } from '@fiapx/shared';
import { renderFailureEmail } from './templates/failure';
import type { NotificationHandler, NotifyDeps } from './notification-handler';

export class NotifyVideoFailedUseCase implements NotificationHandler {
  readonly eventType = ROUTING_KEYS.VIDEO_FAILED;

  constructor(private readonly deps: NotifyDeps) {}

  async execute(envelope: EventEnvelope<unknown>): Promise<void> {
    if (envelope.eventType !== this.eventType) return;

    const payload = envelope.payload as VideoFailedPayload;
    if (!payload.userEmail) {
      this.deps.logger.warn({ videoId: payload.videoId }, 'failure event carries no recipient');
      return;
    }

    if (await this.deps.idempotency.wasProcessed(envelope.eventId)) return;

    const mail = renderFailureEmail({
      originalName: payload.originalName,
      reason: payload.reason,
      appUrl: this.deps.config.appUrl,
      videoId: payload.videoId,
    });

    // A send failure is deliberately not caught: the consumer puts the message on
    // the retry ladder, so a temporary SMTP outage does not lose the notification.
    await this.deps.mailer.send({ to: payload.userEmail, ...mail });
    await this.deps.idempotency.markProcessed(envelope.eventId);

    this.deps.metrics.sent('failure');
    this.deps.logger.info(
      { videoId: payload.videoId, correlationId: envelope.correlationId },
      'failure e-mail sent',
    );
  }
}
