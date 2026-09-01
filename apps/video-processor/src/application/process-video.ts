import {
  ROUTING_KEYS,
  type EventEnvelope,
  type IdempotencyStore,
  type Logger,
  type ObjectStorage,
  type VideoUploadedPayload,
} from '@fiapx/shared';
import type { FrameExtractor } from '../domain/ports/frame-extractor';
import type { ZipArchiver } from '../domain/ports/archiver';
import type { WorkspaceFactory } from '../infrastructure/workspace';
import {
  framesExtractedTotal,
  videoProcessingDuration,
  videoProcessingFailuresTotal,
  videosProcessedTotal,
} from '../infrastructure/metrics';

export interface EventPublisherPort {
  publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void>;
}

export interface ProcessVideoConfig {
  bucketRaw: string;
  bucketZips: string;
}

export interface ProcessVideoDeps {
  storage: ObjectStorage;
  extractor: FrameExtractor;
  zipArchiver: ZipArchiver;
  publisher: EventPublisherPort;
  idempotency: IdempotencyStore;
  workspace: WorkspaceFactory;
  logger: Logger;
  config: ProcessVideoConfig;
}

function extensionOf(storageKey: string): string {
  return storageKey.split('.').at(-1) ?? 'mp4';
}

/**
 * Turns one uploaded video into a zip of frames.
 *
 * The worker owns no database. It reads the event, does the work, and announces
 * the outcome — which is what lets it scale to N replicas with no coordination.
 */
export class ProcessVideoUseCase {
  constructor(private readonly deps: ProcessVideoDeps) {}

  async execute(envelope: EventEnvelope<unknown>, attempt = 0): Promise<void> {
    if (envelope.eventType !== ROUTING_KEYS.VIDEO_UPLOADED) return;

    // A redelivery after a crash must not produce a second zip or a second event.
    if (!(await this.deps.idempotency.markProcessed(envelope.eventId))) {
      this.deps.logger.info({ eventId: envelope.eventId }, 'event already processed, skipping');
      return;
    }

    const payload = envelope.payload as VideoUploadedPayload;
    const log = this.deps.logger.child({
      videoId: payload.videoId,
      correlationId: envelope.correlationId,
    });

    await this.deps.publisher.publish(
      ROUTING_KEYS.VIDEO_PROCESSING_STARTED,
      { videoId: payload.videoId },
      envelope.correlationId,
    );

    const stopTimer = videoProcessingDuration.startTimer();
    const workspace = await this.deps.workspace.create(
      payload.videoId,
      extensionOf(payload.storageKey),
    );

    try {
      const source = await this.deps.storage.getStream(
        this.deps.config.bucketRaw,
        payload.storageKey,
      );
      await this.deps.workspace.saveStream(workspace.inputPath, source);

      const { frameCount, durationMs } = await this.deps.extractor.extract({
        inputPath: workspace.inputPath,
        outputDir: workspace.framesDir,
        frameIntervalSeconds: payload.frameIntervalSeconds,
      });

      if (frameCount === 0) {
        throw new Error(
          'Nenhum frame pôde ser extraído. O arquivo pode estar corrompido ou ser curto demais.',
        );
      }

      const zipKey = `zips/${payload.userId}/${payload.videoId}.zip`;
      const { sizeBytes } = await this.deps.storage.putStream(
        this.deps.config.bucketZips,
        zipKey,
        this.deps.zipArchiver.archive(workspace.framesDir),
        'application/zip',
      );

      await this.deps.publisher.publish(
        ROUTING_KEYS.VIDEO_PROCESSED,
        {
          videoId: payload.videoId,
          userEmail: payload.userEmail,
          originalName: payload.originalName,
          zipKey,
          frameCount,
          durationMs,
          sizeBytes,
        },
        envelope.correlationId,
      );

      videosProcessedTotal.inc();
      framesExtractedTotal.inc(frameCount);
      log.info({ frameCount, sizeBytes }, 'video processed');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha desconhecida';

      await this.deps.publisher.publish(
        ROUTING_KEYS.VIDEO_FAILED,
        {
          videoId: payload.videoId,
          userEmail: payload.userEmail,
          originalName: payload.originalName,
          reason,
          attempt,
        },
        envelope.correlationId,
      );

      videoProcessingFailuresTotal.inc();
      log.error({ err: error, attempt }, 'video processing failed');

      // Rethrown so the consumer puts the message on the retry ladder.
      throw error;
    } finally {
      stopTimer();
      await this.deps.workspace.destroy(workspace.root);
    }
  }
}
