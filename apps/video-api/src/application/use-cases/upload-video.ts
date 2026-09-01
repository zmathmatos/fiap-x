import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { ROUTING_KEYS, ValidationError, type ObjectStorage } from '@fiapx/shared';
import { Video } from '../../domain/entities/video';
import { VideoStatus } from '../../domain/entities/video-status';
import type { VideoRepository } from '../../domain/ports/video-repository';

/** Container formats ffmpeg handles reliably in the worker image. */
export const ALLOWED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'] as const;

export const MIN_FRAME_INTERVAL_SECONDS = 1;
export const MAX_FRAME_INTERVAL_SECONDS = 3600;

export interface UploadVideoInput {
  userId: string;
  userEmail: string;
  originalName: string;
  mimeType: string;
  stream: Readable;
  correlationId?: string;
  frameIntervalSeconds?: number;
}

export interface EventPublisherPort {
  publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void>;
}

export interface UploadVideoConfig {
  bucketRaw: string;
  defaultFrameIntervalSeconds: number;
}

function extensionOf(originalName: string): string {
  const parts = originalName.toLowerCase().split('.');
  return parts.length > 1 ? (parts.at(-1) ?? '') : '';
}

export class UploadVideoUseCase {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
    private readonly publisher: EventPublisherPort,
    private readonly config: UploadVideoConfig,
  ) {}

  async execute(input: UploadVideoInput): Promise<Video> {
    const extension = extensionOf(input.originalName);
    if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
      throw new ValidationError(
        `Formato não suportado. Envie um arquivo ${ALLOWED_EXTENSIONS.join(', ')}.`,
      );
    }

    const frameIntervalSeconds =
      input.frameIntervalSeconds ?? this.config.defaultFrameIntervalSeconds;
    if (
      !Number.isInteger(frameIntervalSeconds) ||
      frameIntervalSeconds < MIN_FRAME_INTERVAL_SECONDS ||
      frameIntervalSeconds > MAX_FRAME_INTERVAL_SECONDS
    ) {
      throw new ValidationError(
        `O intervalo entre frames deve estar entre ${MIN_FRAME_INTERVAL_SECONDS} e ${MAX_FRAME_INTERVAL_SECONDS} segundos.`,
      );
    }

    const videoId = randomUUID();
    const storageKey = `raw/${input.userId}/${videoId}.${extension}`;

    // The request body is piped straight through to object storage — a 500 MB
    // upload never lands in memory or on the API's disk.
    await this.storage.putStream(this.config.bucketRaw, storageKey, input.stream, input.mimeType);

    const now = new Date();
    let video = await this.videos.save(
      new Video({
        id: videoId,
        userId: input.userId,
        originalName: input.originalName,
        storageKey,
        status: VideoStatus.PENDING,
        frameIntervalSeconds,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await this.videos.appendEvent(video.id, ROUTING_KEYS.VIDEO_UPLOADED, {
      originalName: input.originalName,
      storageKey,
      frameIntervalSeconds,
    });

    try {
      await this.publisher.publish(
        ROUTING_KEYS.VIDEO_UPLOADED,
        {
          videoId: video.id,
          userId: input.userId,
          userEmail: input.userEmail,
          storageKey,
          originalName: input.originalName,
          frameIntervalSeconds,
        },
        input.correlationId,
      );
    } catch (error) {
      // Publishing uses confirms, so reaching here means the broker never took the
      // message. Nobody will ever process this video — fail it now rather than
      // leaving a row that stays PENDING forever.
      const reason = error instanceof Error ? error.message : 'Falha ao publicar o evento';
      video.markFailed(`Não foi possível enfileirar o processamento: ${reason}`);
      video = await this.videos.save(video);
      throw error;
    }

    return video;
  }
}
