export type VideoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface VideoSummary {
  id: string;
  originalName: string;
  status: VideoStatus;
  frameCount: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  frameIntervalSeconds: number;
  errorReason: string | null;
  downloadable: boolean;
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
