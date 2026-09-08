export type VideoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface VideoSummary {
  id: string;
  originalName: string;
  /** Name the user gave it; null when they never renamed it. */
  title: string | null;
  /** What to show: the title when there is one, the file name otherwise. */
  displayName: string;
  /** API path to the poster frame. Null until the worker has extracted one. */
  thumbnailUrl: string | null;
  status: VideoStatus;
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
  /** Live progress while processing; null when unknown or already finished. */
  progressPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface VideoDetail extends VideoSummary {
  events: VideoEvent[];
}

export interface VideoPage {
  items: VideoSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}
