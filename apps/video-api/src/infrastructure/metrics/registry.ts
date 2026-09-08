import type { MetricsExporter, VideoMetrics } from '../../application/ports/metrics';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: 'fiapx_api_' });

const videosUploadedTotal = new Counter({
  name: 'videos_uploaded_total',
  help: 'Vídeos aceitos para processamento',
  registers: [registry],
});

export const videosProcessedTotal = new Counter({
  name: 'videos_processed_total',
  help: 'Vídeos que concluíram o processamento',
  registers: [registry],
});

export const videoProcessingFailuresTotal = new Counter({
  name: 'video_processing_failures_total',
  help: 'Vídeos que terminaram em falha',
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3, 10],
  registers: [registry],
});

export const metricsExporter: MetricsExporter = {
  contentType: registry.contentType,
  render: () => registry.metrics(),
};

export const videoMetrics: VideoMetrics = {
  uploadAccepted: () => videosUploadedTotal.inc(),
};
