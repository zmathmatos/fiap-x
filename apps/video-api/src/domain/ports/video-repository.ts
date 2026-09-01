import type { Video } from '../entities/video';
import type { VideoStatus } from '../entities/video-status';

export interface VideoEventRecord {
  id: string;
  videoId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ListVideosFilter {
  status?: VideoStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface VideoPage {
  items: Video[];
  total: number;
}

export interface VideoRepository {
  save(video: Video): Promise<Video>;
  /** Scoped lookup. Returns `null` when the video belongs to somebody else. */
  findByIdForUser(id: string, userId: string): Promise<Video | null>;
  /** Unscoped lookup, for event consumers that act on behalf of the system. */
  findById(id: string): Promise<Video | null>;
  listByUser(userId: string, filter: ListVideosFilter): Promise<VideoPage>;
  appendEvent(videoId: string, type: string, payload: Record<string, unknown>): Promise<void>;
  listEvents(videoId: string): Promise<VideoEventRecord[]>;
}
