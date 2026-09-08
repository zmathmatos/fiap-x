/** Stops a running timer and records the elapsed time. */
export type StopTimer = () => void;

/** What the use case reports about its own work, without knowing Prometheus exists. */
export interface ProcessingMetrics {
  startTimer(): StopTimer;
  videoProcessed(frameCount: number): void;
  videoFailed(): void;
}
