/** What the health server needs from the metrics registry, and nothing more. */
export interface MetricsExporter {
  readonly contentType: string;
  render(): Promise<string>;
}
