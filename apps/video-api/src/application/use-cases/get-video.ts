import { NotFoundError } from '@fiapx/shared';
import type { VideoRepository } from '../../domain/ports/video-repository';
import {
  presentVideo,
  presentVideoEvent,
  type VideoEventView,
  type VideoView,
} from '../presenters/video-presenter';

export interface GetVideoInput {
  userId: string;
  videoId: string;
}

export interface GetVideoOutput extends VideoView {
  events: VideoEventView[];
}

export class GetVideoUseCase {
  constructor(private readonly videos: VideoRepository) {}

  async execute(input: GetVideoInput): Promise<GetVideoOutput> {
    const video = await this.videos.findByIdForUser(input.videoId, input.userId);
    if (!video) {
      // 404 and not 403: a wrong owner must not be able to prove the id exists.
      throw new NotFoundError('Vídeo');
    }

    const events = await this.videos.listEvents(video.id);
    return { ...presentVideo(video), events: events.map(presentVideoEvent) };
  }
}
