import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: 'fiapx_processor_' });

export const videoProcessingDuration = new Histogram({
  name: 'video_processing_duration_seconds',
  help: 'Tempo total de processamento de um vídeo',
  buckets: [1, 5, 15, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const videosProcessedTotal = new Counter({
  name: 'videos_processed_total',
  help: 'Vídeos processados com sucesso pelo worker',
  registers: [registry],
});

export const videoProcessingFailuresTotal = new Counter({
  name: 'video_processing_failures_total',
  help: 'Falhas de processamento no worker',
  registers: [registry],
});

export const framesExtractedTotal = new Counter({
  name: 'frames_extracted_total',
  help: 'Frames extraídos no total',
  registers: [registry],
});
