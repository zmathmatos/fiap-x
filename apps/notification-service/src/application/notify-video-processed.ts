import {
  ROUTING_KEYS,
  type EventEnvelope,
  type VideoProcessedPayload,
} from '@fiapx/shared';
import { renderSuccessEmail } from './templates/success';
import type { NotifyDeps } from './notify-video-failed';

export class NotifyVideoProcessedUseCase {
  constructor(private readonly deps: NotifyDeps) {}

  async execute(envelope: EventEnvelope<unknown>): Promise<void> {
    if (envelope.eventType !== ROUTING_KEYS.VIDEO_PROCESSED) return;

    const payload = envelope.payload as VideoProcessedPayload;
    if (!payload.userEmail) {
      this.deps.logger.warn({ videoId: payload.videoId }, 'success event carries no recipient');
      return;
    }

    if (!(await this.deps.idempotency.markProcessed(envelope.eventId))) return;

    const mail = renderSuccessEmail({
      originalName: payload.originalName,
      frameCount: payload.frameCount,
      appUrl: this.deps.config.appUrl,
      videoId: payload.videoId,
    });

    await this.deps.mailer.send({ to: payload.userEmail, ...mail });

    this.deps.logger.info(
      { videoId: payload.videoId, correlationId: envelope.correlationId },
      'success e-mail sent',
    );
  }
}
