import type { Readable } from 'node:stream';
import { NotFoundError, type ObjectStorage } from '@fiapx/shared';
import type { VideoRepository } from '../../domain/ports/video-repository';

export interface GetVideoThumbnailInput {
  userId: string;
  videoId: string;
}

export interface GetVideoThumbnailOutput {
  stream: Readable;
  sizeBytes: number;
}

export interface ThumbnailConfig {
  bucketZips: string;
}

/**
 * Streams the poster frame the worker kept when it processed the video.
 *
 * Scoped to the owner like every other video route: a poster is a frame of
 * somebody's video, so it is exactly as private as the video itself.
 */
export class GetVideoThumbnailUseCase {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
    private readonly config: ThumbnailConfig,
  ) {}

  async execute(input: GetVideoThumbnailInput): Promise<GetVideoThumbnailOutput> {
    const video = await this.videos.findByIdForUser(input.videoId, input.userId);
    if (!video?.thumbnailKey) {
      // Also 404 when the key is missing: an unprocessed video has no poster, and
      // that is indistinguishable from "no such video" as far as the client cares.
      throw new NotFoundError('Miniatura');
    }

    const metadata = await this.storage.head(this.config.bucketZips, video.thumbnailKey);
    const stream = await this.storage.getStream(this.config.bucketZips, video.thumbnailKey);

    return { stream, sizeBytes: metadata.sizeBytes };
  }
}
