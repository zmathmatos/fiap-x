export const VideoStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

export const VIDEO_STATUSES: readonly VideoStatus[] = Object.values(VideoStatus);

/**
 * Allowed status transitions.
 *
 * Terminal states accept nothing, which is what makes the whole pipeline safe
 * against events arriving out of order: a late `processing.started` after a
 * `processed` simply has nowhere to go.
 */
const ALLOWED_TRANSITIONS: Record<VideoStatus, readonly VideoStatus[]> = {
  [VideoStatus.PENDING]: [VideoStatus.PROCESSING, VideoStatus.FAILED],
  [VideoStatus.PROCESSING]: [VideoStatus.COMPLETED, VideoStatus.FAILED],
  [VideoStatus.COMPLETED]: [],
  [VideoStatus.FAILED]: [],
};

export function canTransition(from: VideoStatus, to: VideoStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: VideoStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

export function isVideoStatus(value: string): value is VideoStatus {
  return VIDEO_STATUSES.includes(value as VideoStatus);
}
