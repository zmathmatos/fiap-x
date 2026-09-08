import { ValidationError, type ProgressStore } from '@fiapx/shared';
import { isVideoStatus, VideoStatus } from '../../domain/entities/video-status';
import type { VideoRepository } from '../../domain/ports/video-repository';
import { presentVideo, type VideoView } from '../presenters/video-presenter';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface ListVideosInput {
  userId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListVideosOutput {
  items: VideoView[];
  total: number;
  page: number;
  limit: number;
}

export class ListVideosUseCase {
  constructor(
    private readonly videos: VideoRepository,
    private readonly progress: ProgressStore,
  ) {}

  async execute(input: ListVideosInput): Promise<ListVideosOutput> {
    let status: VideoStatus | undefined;
    if (input.status !== undefined && input.status !== '') {
      if (!isVideoStatus(input.status)) {
        throw new ValidationError(`Status inválido: "${input.status}".`);
      }
      status = input.status;
    }

    // Clamp rather than reject: a bad page size is not worth failing a listing over,
    // but an unbounded one would let a client ask for the whole table.
    const page = Math.max(1, Math.trunc(input.page ?? 1) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(input.limit ?? DEFAULT_PAGE_SIZE)),
    );
    const search = input.search?.trim() ? input.search.trim() : undefined;

    const { items, total } = await this.videos.listByUser(input.userId, {
      status,
      search,
      page,
      limit,
    });

    const live = await this.progress.read(
      items.filter((video) => video.status === VideoStatus.PROCESSING).map((video) => video.id),
    );

    return {
      items: items.map((video) => presentVideo(video, live.get(video.id) ?? null)),
      total,
      page,
      limit,
    };
  }
}
