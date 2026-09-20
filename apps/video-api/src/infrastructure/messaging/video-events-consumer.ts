import { ROUTING_KEYS, type Logger, type RabbitConnection } from '@fiapx/shared';
import type { ApplyProcessingEventUseCase } from '../../application/use-cases/apply-processing-event';

export const VIDEO_EVENTS_QUEUE = 'video-api.video-events';

export interface VideoEventsConsumerDeps {
  connection: RabbitConnection;
  exchange: string;
  applyProcessingEvent: ApplyProcessingEventUseCase;
  logger: Logger;
}

/**
 * Keeps the API's view of a video in step with what the worker reports.
 *
 * The API owns the database, so it is the only service that writes status — the
 * worker only announces what happened.
 */
export async function startVideoEventsConsumer(deps: VideoEventsConsumerDeps): Promise<void> {
  await deps.connection.consume({
    queue: VIDEO_EVENTS_QUEUE,
    exchange: deps.exchange,
    routingKeys: [
      ROUTING_KEYS.VIDEO_PROCESSING_STARTED,
      ROUTING_KEYS.VIDEO_PROCESSED,
      ROUTING_KEYS.VIDEO_FAILED,
    ],
    prefetch: 10,
    handler: async (envelope) => {
      await deps.applyProcessingEvent.execute(envelope);
    },
  });

  deps.logger.info({ queue: VIDEO_EVENTS_QUEUE }, 'video events consumer started');
}
