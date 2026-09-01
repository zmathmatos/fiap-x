export interface VideoUploadedPayload {
  videoId: string;
  userId: string;
  userEmail: string;
  storageKey: string;
  originalName: string;
  frameIntervalSeconds: number;
}

export interface VideoProcessingStartedPayload {
  videoId: string;
}

/**
 * `userEmail` and `originalName` are repeated on the result payloads on purpose:
 * the notification service owns no database, so the event has to carry everything
 * needed to compose the e-mail.
 */
export interface VideoProcessedPayload {
  videoId: string;
  userEmail: string;
  originalName: string;
  zipKey: string;
  frameCount: number;
  durationMs: number;
  sizeBytes: number;
}

export interface VideoFailedPayload {
  videoId: string;
  userEmail: string;
  originalName: string;
  reason: string;
  attempt: number;
}
