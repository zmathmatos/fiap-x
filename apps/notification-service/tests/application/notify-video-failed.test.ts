import { createEnvelope, createLogger, ROUTING_KEYS } from '@fiapx/shared';
import { NotifyVideoFailedUseCase } from '../../src/application/notify-video-failed';
import { NotifyVideoProcessedUseCase } from '../../src/application/notify-video-processed';

const failedPayload = {
  videoId: 'v1',
  userEmail: 'user@fiapx.local',
  originalName: 'clip.mp4',
  reason: 'ffmpeg exited with code 1',
  attempt: 3,
};

const processedPayload = {
  videoId: 'v1',
  userEmail: 'user@fiapx.local',
  originalName: 'clip.mp4',
  zipKey: 'zips/u1/v1.zip',
  frameCount: 9,
  durationMs: 180_000,
  sizeBytes: 4096,
};

function makeDeps() {
  const mailer = { send: jest.fn().mockResolvedValue(undefined) };
  const idempotency = { markProcessed: jest.fn().mockResolvedValue(true) };
  const config = { appUrl: 'http://localhost:8080' };
  const logger = createLogger('test');

  return {
    mailer,
    idempotency,
    failed: new NotifyVideoFailedUseCase({ mailer, idempotency, config, logger }),
    processed: new NotifyVideoProcessedUseCase({ mailer, idempotency, config, logger }),
  };
}

describe('NotifyVideoFailedUseCase', () => {
  it('sends one e-mail to the video owner', async () => {
    const { mailer, failed } = makeDeps();

    await failed.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload));

    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@fiapx.local' }),
    );
  });

  it('does not send twice for the same event', async () => {
    const { mailer, idempotency, failed } = makeDeps();
    idempotency.markProcessed.mockResolvedValue(false);

    await failed.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload));

    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('ignores an event type it does not own', async () => {
    const { mailer, failed } = makeDeps();

    await failed.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, processedPayload));

    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('lets a smtp failure surface so the message is retried', async () => {
    const { mailer, failed } = makeDeps();
    mailer.send.mockRejectedValue(new Error('smtp unreachable'));

    await expect(
      failed.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload)),
    ).rejects.toThrow('smtp unreachable');
  });

  it('skips the e-mail when the event carries no recipient', async () => {
    const { mailer, failed } = makeDeps();

    await failed.execute(
      createEnvelope(ROUTING_KEYS.VIDEO_FAILED, { ...failedPayload, userEmail: '' }),
    );

    expect(mailer.send).not.toHaveBeenCalled();
  });
});

describe('NotifyVideoProcessedUseCase', () => {
  it('sends the success e-mail with the frame count', async () => {
    const { mailer, processed } = makeDeps();

    await processed.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, processedPayload));

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@fiapx.local',
        subject: '"clip.mp4" está pronto',
      }),
    );
  });

  it('ignores a failure event', async () => {
    const { mailer, processed } = makeDeps();

    await processed.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload));

    expect(mailer.send).not.toHaveBeenCalled();
  });
});
