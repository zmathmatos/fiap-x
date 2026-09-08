import { createEnvelope, ROUTING_KEYS } from '@fiapx/shared';
import { NotificationRouter } from '../../src/application/notification-router';
import type { NotificationHandler } from '../../src/application/notification-handler';

function makeHandler(eventType: string): jest.Mocked<NotificationHandler> {
  return { eventType, execute: jest.fn().mockResolvedValue(undefined) } as never;
}

describe('NotificationRouter', () => {
  it('binds only the routing keys its handlers own', () => {
    const router = new NotificationRouter([
      makeHandler(ROUTING_KEYS.VIDEO_FAILED),
      makeHandler(ROUTING_KEYS.VIDEO_PROCESSED),
    ]);

    expect(router.routingKeys).toEqual([ROUTING_KEYS.VIDEO_FAILED, ROUTING_KEYS.VIDEO_PROCESSED]);
  });

  it('gives an event to the one handler that owns it', async () => {
    const failed = makeHandler(ROUTING_KEYS.VIDEO_FAILED);
    const processed = makeHandler(ROUTING_KEYS.VIDEO_PROCESSED);
    const envelope = createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, { videoId: 'v1' });

    await new NotificationRouter([failed, processed]).dispatch(envelope);

    expect(processed.execute).toHaveBeenCalledWith(envelope);
    expect(failed.execute).not.toHaveBeenCalled();
  });

  it('ignores an event nobody registered for', async () => {
    const failed = makeHandler(ROUTING_KEYS.VIDEO_FAILED);

    await new NotificationRouter([failed]).dispatch(
      createEnvelope(ROUTING_KEYS.VIDEO_UPLOADED, { videoId: 'v1' }),
    );

    expect(failed.execute).not.toHaveBeenCalled();
  });
});
