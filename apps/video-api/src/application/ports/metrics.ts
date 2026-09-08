/** What the HTTP layer needs from the metrics registry, and nothing more. */
export interface MetricsExporter {
  readonly contentType: string;
  render(): Promise<string>;
}

/** Counters the video routes bump. Kept behind a port so controllers stay pure. */
export interface VideoMetrics {
  uploadAccepted(): void;
}
