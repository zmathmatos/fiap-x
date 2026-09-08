import { NotFoundError } from '@fiapx/shared';
import { VideoTitle } from '../../domain/value-objects/video-title';
import type { VideoRepository } from '../../domain/ports/video-repository';
import { presentVideo, type VideoView } from '../presenters/video-presenter';

export interface RenameVideoInput {
  userId: string;
  videoId: string;
  title: string | null;
}

/**
 * Gives a video a human name without touching the file it came from.
 *
 * The file name stays the file name: it is what the downloaded zip is called and
 * what the notification e-mail quotes back. The title is only what the library
 * shows and searches.
 */
export class RenameVideoUseCase {
  constructor(private readonly videos: VideoRepository) {}

  async execute(input: RenameVideoInput): Promise<VideoView> {
    const title = VideoTitle.of(input.title);

    const video = await this.videos.findByIdForUser(input.videoId, input.userId);
    if (!video) {
      // 404 and not 403: a wrong owner must not be able to prove the id exists.
      throw new NotFoundError('Vídeo');
    }

    video.rename(title);

    return presentVideo(await this.videos.save(video));
  }
}
