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
  /** Probed from the source file. Null whenever the container does not carry it. */
  codec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitrateBps: number | null;
  /** Storage key of the first extracted frame, kept as the library poster. */
  thumbnailKey: string | null;
}

export interface VideoFailedPayload {
  videoId: string;
  userEmail: string;
  originalName: string;
  reason: string;
  attempt: number;
}
