import { posix } from 'node:path';
import {
  ROUTING_KEYS,
  type EventEnvelope,
  type IdempotencyStore,
  type Logger,
  type ObjectStorage,
  type ProgressStore,
  type VideoUploadedPayload,
} from '@fiapx/shared';
import type { FrameExtractor, VideoMetadata } from '../domain/ports/frame-extractor';
import type { ZipArchiver } from '../domain/ports/archiver';
import type { JobWorkspace, WorkspaceFactory } from '../domain/ports/workspace';
import type { ProcessingMetrics } from '../domain/ports/processing-metrics';
import { UnprocessableVideoError } from '../domain/errors';

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
  progress: ProgressStore;
  workspace: WorkspaceFactory;
  metrics: ProcessingMetrics;
  logger: Logger;
  config: ProcessVideoConfig;
}

/** ffmpeg writes `frame-00001.jpg` first; that is the one the library shows. */
const FIRST_FRAME = 'frame-00001.jpg';

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

    if (await this.deps.idempotency.wasProcessed(envelope.eventId)) {
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

    const stopTimer = this.deps.metrics.startTimer();
    const workspace = await this.deps.workspace.create(
      payload.videoId,
      extensionOf(payload.storageKey),
    );

    try {
      await this.fetchSource(payload, workspace);
      const { frameCount, metadata } = await this.extractFrames(payload, workspace, log);

      const thumbnailKey = await this.storePoster(payload, workspace, log);
      const { zipKey, sizeBytes } = await this.storeArchive(payload, workspace);

      await this.publishProcessed(envelope, payload, {
        zipKey,
        sizeBytes,
        frameCount,
        metadata,
        thumbnailKey,
      });

      await this.deps.idempotency.markProcessed(envelope.eventId);

      this.deps.metrics.videoProcessed(frameCount);
      log.info({ frameCount, sizeBytes }, 'video processed');
    } catch (error) {
      await this.publishFailure(envelope, payload, attempt, error);

      this.deps.metrics.videoFailed();
      log.error({ err: error, attempt }, 'video processing failed');

      if (error instanceof UnprocessableVideoError) {
        await this.deps.idempotency.markProcessed(envelope.eventId);
        return;
      }

      // Rethrown so the consumer puts the message on the retry ladder.
      throw error;
    } finally {
      stopTimer();
      await this.deps.workspace.destroy(workspace.root);
    }
  }

  private async fetchSource(payload: VideoUploadedPayload, workspace: JobWorkspace): Promise<void> {
    const source = await this.deps.storage.getStream(
      this.deps.config.bucketRaw,
      payload.storageKey,
    );
    await this.deps.workspace.saveStream(workspace.inputPath, source);
  }

  private async extractFrames(
    payload: VideoUploadedPayload,
    workspace: JobWorkspace,
    log: Logger,
  ): Promise<{ frameCount: number; metadata: VideoMetadata }> {
    const result = await this.deps.extractor.extract({
      inputPath: workspace.inputPath,
      outputDir: workspace.framesDir,
      frameIntervalSeconds: payload.frameIntervalSeconds,
      onProgress: (percent) => {
        // Fire and forget: a progress bar is never worth failing a job over, and
        // awaiting here would stall the ffmpeg stdout pump.
        void this.deps.progress
          .report(payload.videoId, percent)
          .catch((error: unknown) => log.warn({ err: error }, 'could not report progress'));
      },
    });

    if (result.frameCount === 0) {
      throw new Error(
        'Nenhum frame pôde ser extraído. O arquivo pode estar corrompido ou ser curto demais.',
      );
    }
    return result;
  }

  /**
   * Best effort: the poster is decoration, and a video with 600 usable frames must
   * not fail because one of them could not be copied out.
   */
  private async storePoster(
    payload: VideoUploadedPayload,
    workspace: JobWorkspace,
    log: Logger,
  ): Promise<string | null> {
    const thumbnailKey = `thumbs/${payload.userId}/${payload.videoId}.jpg`;

    try {
      await this.deps.storage.putStream(
        this.deps.config.bucketZips,
        thumbnailKey,
        this.deps.workspace.openStream(posix.join(workspace.framesDir, FIRST_FRAME)),
        'image/jpeg',
      );
      return thumbnailKey;
    } catch (error) {
      log.warn({ err: error }, 'could not store the poster frame');
      return null;
    }
  }

  private async storeArchive(
    payload: VideoUploadedPayload,
    workspace: JobWorkspace,
  ): Promise<{ zipKey: string; sizeBytes: number }> {
    const zipKey = `zips/${payload.userId}/${payload.videoId}.zip`;
    const { sizeBytes } = await this.deps.storage.putStream(
      this.deps.config.bucketZips,
      zipKey,
      this.deps.zipArchiver.archive(workspace.framesDir),
      'application/zip',
    );

    return { zipKey, sizeBytes };
  }

  private publishProcessed(
    envelope: EventEnvelope<unknown>,
    payload: VideoUploadedPayload,
    result: {
      zipKey: string;
      sizeBytes: number;
      frameCount: number;
      metadata: VideoMetadata;
      thumbnailKey: string | null;
    },
  ): Promise<void> {
    return this.deps.publisher.publish(
      ROUTING_KEYS.VIDEO_PROCESSED,
      {
        videoId: payload.videoId,
        userEmail: payload.userEmail,
        originalName: payload.originalName,
        zipKey: result.zipKey,
        frameCount: result.frameCount,
        durationMs: result.metadata.durationMs,
        sizeBytes: result.sizeBytes,
        codec: result.metadata.codec,
        width: result.metadata.width,
        height: result.metadata.height,
        frameRate: result.metadata.frameRate,
        bitrateBps: result.metadata.bitrateBps,
        thumbnailKey: result.thumbnailKey,
      },
      envelope.correlationId,
    );
  }

  private publishFailure(
    envelope: EventEnvelope<unknown>,
    payload: VideoUploadedPayload,
    attempt: number,
    error: unknown,
  ): Promise<void> {
    return this.deps.publisher.publish(
      ROUTING_KEYS.VIDEO_FAILED,
      {
        videoId: payload.videoId,
        userEmail: payload.userEmail,
        originalName: payload.originalName,
        reason: error instanceof Error ? error.message : 'Falha desconhecida',
        attempt,
      },
      envelope.correlationId,
    );
  }
}
