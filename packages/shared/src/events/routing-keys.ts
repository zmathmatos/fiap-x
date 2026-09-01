export const ROUTING_KEYS = {
  VIDEO_UPLOADED: 'video.uploaded',
  VIDEO_PROCESSING_STARTED: 'video.processing.started',
  VIDEO_PROCESSED: 'video.processed',
  VIDEO_FAILED: 'video.failed',
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];
