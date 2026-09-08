import type { Video } from '../../domain/entities/video';
import type { VideoEventRecord } from '../../domain/ports/video-repository';

export interface VideoView {
  id: string;
  originalName: string;
  /** The name the user gave it; null when they never renamed it. */
  title: string | null;
  /** What every screen shows: the title when there is one, the file name otherwise. */
  displayName: string;
  /** Path to the poster frame, relative to the API. Null until processing finishes. */
  thumbnailUrl: string | null;
  status: string;
  frameCount: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  frameIntervalSeconds: number;
  errorReason: string | null;
  downloadable: boolean;
  codec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitrateBps: number | null;
  /**
   * How far along the worker is, when it is still running. Null covers both
   * "not processing" and "processing but nothing reported yet" — the client
   * shows an indeterminate bar for either, so they need no distinction.
   */
  progressPercent: number | null;
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
export function presentVideo(video: Video, progressPercent: number | null = null): VideoView {
  return {
    id: video.id,
    originalName: video.originalName,
    title: video.title,
    displayName: video.displayName,
    thumbnailUrl: video.thumbnailKey === null ? null : `/videos/${video.id}/thumbnail`,
    status: video.status,
    frameCount: video.frameCount,
    durationMs: video.durationMs,
    sizeBytes: video.sizeBytes,
    frameIntervalSeconds: video.frameIntervalSeconds,
    errorReason: video.errorReason,
    downloadable: video.isDownloadable(),
    codec: video.codec,
    width: video.width,
    height: video.height,
    frameRate: video.frameRate,
    bitrateBps: video.bitrateBps,
    progressPercent,
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
