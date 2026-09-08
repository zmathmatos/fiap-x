import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { ROUTING_KEYS, type ObjectStorage } from '@fiapx/shared';
import { Video } from '../../domain/entities/video';
import { VideoStatus } from '../../domain/entities/video-status';
import { FrameInterval } from '../../domain/value-objects/frame-interval';
import { VideoFormat } from '../../domain/value-objects/video-format';
import { VideoTitle } from '../../domain/value-objects/video-title';
import type { VideoRepository } from '../../domain/ports/video-repository';
import { presentVideo, type VideoView } from '../presenters/video-presenter';

export interface UploadVideoInput {
  userId: string;
  userEmail: string;
  originalName: string;
  mimeType: string;
  stream: Readable;
  correlationId?: string;
  frameIntervalSeconds?: number;
  /** Optional name the user typed in the upload form, instead of the file name. */
  title?: string;
}

export interface EventPublisherPort {
  publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void>;
}

export interface UploadVideoConfig {
  bucketRaw: string;
  defaultFrameIntervalSeconds: number;
}

export class UploadVideoUseCase {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
    private readonly publisher: EventPublisherPort,
    private readonly config: UploadVideoConfig,
  ) {}

  async execute(input: UploadVideoInput): Promise<VideoView> {
    const format = VideoFormat.fromFilename(input.originalName);
    const interval = FrameInterval.of(
      input.frameIntervalSeconds ?? this.config.defaultFrameIntervalSeconds,
    );
    const title = VideoTitle.of(input.title);

    const videoId = randomUUID();
    const storageKey = `raw/${input.userId}/${videoId}.${format.extension}`;

    // The request body is piped straight through to object storage — a 500 MB
    // upload never lands in memory or on the API's disk.
    await this.storage.putStream(this.config.bucketRaw, storageKey, input.stream, input.mimeType);

    const now = new Date();
    const video = await this.videos.save(
      new Video({
        id: videoId,
        userId: input.userId,
        originalName: input.originalName,
        title: title?.value ?? null,
        storageKey,
        status: VideoStatus.PENDING,
        frameIntervalSeconds: interval.seconds,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.videos.appendEvent(video.id, ROUTING_KEYS.VIDEO_UPLOADED, {
      originalName: input.originalName,
      storageKey,
      frameIntervalSeconds: interval.seconds,
    });

    await this.announce(video, input, storageKey, interval);

    return presentVideo(video);
  }

  /**
   * Publishing uses confirms, so a rejection means the broker never took the
   * message. Nobody will ever process this video — fail it now rather than leave a
   * row that stays PENDING forever.
   */
  private async announce(
    video: Video,
    input: UploadVideoInput,
    storageKey: string,
    interval: FrameInterval,
  ): Promise<void> {
    try {
      await this.publisher.publish(
        ROUTING_KEYS.VIDEO_UPLOADED,
        {
          videoId: video.id,
          userId: input.userId,
          userEmail: input.userEmail,
          storageKey,
          originalName: input.originalName,
          frameIntervalSeconds: interval.seconds,
        },
        input.correlationId,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha ao publicar o evento';
      video.markFailed(`Não foi possível enfileirar o processamento: ${reason}`);
      await this.videos.save(video);
      throw error;
    }
  }
}
