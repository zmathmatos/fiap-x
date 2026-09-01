import type { Video } from '../../domain/entities/video';
import type { VideoEventRecord } from '../../domain/ports/video-repository';

export interface VideoView {
  id: string;
  originalName: string;
  status: string;
  frameCount: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  frameIntervalSeconds: number;
  errorReason: string | null;
  downloadable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoEventView {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Single place that decides what a video looks like over the wire. */
export function presentVideo(video: Video): VideoView {
  return {
    id: video.id,
    originalName: video.originalName,
    status: video.status,
    frameCount: video.frameCount,
    durationMs: video.durationMs,
    sizeBytes: video.sizeBytes,
    frameIntervalSeconds: video.frameIntervalSeconds,
    errorReason: video.errorReason,
    downloadable: video.isDownloadable(),
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}

export function presentVideoEvent(event: VideoEventRecord): VideoEventView {
  return {
    id: event.id,
    type: event.type,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
