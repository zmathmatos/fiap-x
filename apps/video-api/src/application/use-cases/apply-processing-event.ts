import {
  ROUTING_KEYS,
  type EventEnvelope,
  type IdempotencyStore,
  type VideoFailedPayload,
  type VideoProcessedPayload,
  type VideoProcessingStartedPayload,
} from '@fiapx/shared';
import type { VideoRepository } from '../../domain/ports/video-repository';

type ResultPayload = VideoProcessingStartedPayload | VideoProcessedPayload | VideoFailedPayload;

const OWNED_EVENTS: readonly string[] = [
  ROUTING_KEYS.VIDEO_PROCESSING_STARTED,
  ROUTING_KEYS.VIDEO_PROCESSED,
  ROUTING_KEYS.VIDEO_FAILED,
];

/**
 * Applies a processing event from the worker to the video the API owns.
 *
 * Two guards keep this safe under at-least-once delivery: the idempotency store
 * rejects an event id that was already applied, and the status machine rejects a
 * transition that arrives out of order. Neither is an error — both just stop.
 */
export class ApplyProcessingEventUseCase {
  constructor(
    private readonly videos: VideoRepository,
    private readonly idempotency: IdempotencyStore,
  ) {}

  async execute(envelope: EventEnvelope<unknown>): Promise<void> {
    if (!OWNED_EVENTS.includes(envelope.eventType)) return;

    if (!(await this.idempotency.markProcessed(envelope.eventId))) return;

    const payload = envelope.payload as ResultPayload;
    const video = await this.videos.findById(payload.videoId);
    if (!video) return;

    let applied = false;

    switch (envelope.eventType) {
      case ROUTING_KEYS.VIDEO_PROCESSING_STARTED:
        applied = video.markProcessing();
        break;

      case ROUTING_KEYS.VIDEO_PROCESSED: {
        const processed = payload as VideoProcessedPayload;
        applied = video.markCompleted({
          zipKey: processed.zipKey,
          frameCount: processed.frameCount,
          durationMs: processed.durationMs,
          sizeBytes: processed.sizeBytes,
          codec: processed.codec,
          width: processed.width,
          height: processed.height,
          frameRate: processed.frameRate,
          bitrateBps: processed.bitrateBps,
          thumbnailKey: processed.thumbnailKey,
        });
        break;
      }

      case ROUTING_KEYS.VIDEO_FAILED:
        applied = video.markFailed((payload as VideoFailedPayload).reason);
        break;
    }

    if (!applied) return;

    await this.videos.save(video);
    await this.videos.appendEvent(video.id, envelope.eventType, {
      ...(payload as unknown as Record<string, unknown>),
    });
  }
}
