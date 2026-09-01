import { Readable } from 'node:stream';
import { createEnvelope, ROUTING_KEYS, createLogger } from '@fiapx/shared';
import { ProcessVideoUseCase } from '../../src/application/process-video';

const payload = {
  videoId: 'v1',
  userId: 'u1',
  userEmail: 'user@fiapx.local',
  storageKey: 'raw/u1/v1.mp4',
  originalName: 'clip.mp4',
  frameIntervalSeconds: 20,
};

const envelope = createEnvelope(ROUTING_KEYS.VIDEO_UPLOADED, payload, 'corr-1');

function makeDeps() {
  const storage = {
    getStream: jest.fn().mockResolvedValue(Readable.from(['video-bytes'])),
    putStream: jest.fn().mockResolvedValue({ sizeBytes: 12_345 }),
    head: jest.fn(),
    remove: jest.fn(),
    ensureBuckets: jest.fn(),
    isHealthy: jest.fn(),
  };

  const extractor = {
    extract: jest.fn().mockResolvedValue({ frameCount: 9, durationMs: 180_000 }),
  };

  const zipArchiver = { archive: jest.fn().mockReturnValue(Readable.from(['zip-bytes'])) };
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const idempotency = { markProcessed: jest.fn().mockResolvedValue(true) };
  const workspace = {
    create: jest.fn().mockResolvedValue({ root: '/tmp/job', inputPath: '/tmp/job/in.mp4', framesDir: '/tmp/job/frames' }),
    saveStream: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new ProcessVideoUseCase({
    storage,
    extractor,
    zipArchiver,
    publisher,
    idempotency,
    workspace,
    logger: createLogger('test'),
    config: { bucketRaw: 'fiapx-raw', bucketZips: 'fiapx-zips' },
  });

  return { storage, extractor, zipArchiver, publisher, idempotency, workspace, useCase };
}

describe('ProcessVideoUseCase', () => {
  it('publishes processing.started before doing any heavy work', async () => {
    const { publisher, useCase } = makeDeps();

    await useCase.execute(envelope);

    expect(publisher.publish.mock.calls[0]?.[0]).toBe('video.processing.started');
  });

  it('uploads the zip and publishes video.processed with the frame count', async () => {
    const { storage, publisher, useCase } = makeDeps();

    await useCase.execute(envelope);

    expect(storage.putStream).toHaveBeenCalledWith(
      'fiapx-zips',
      'zips/u1/v1.zip',
      expect.anything(),
      'application/zip',
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      'video.processed',
      {
        videoId: 'v1',
        userEmail: 'user@fiapx.local',
        originalName: 'clip.mp4',
        zipKey: 'zips/u1/v1.zip',
        frameCount: 9,
        durationMs: 180_000,
        sizeBytes: 12_345,
      },
      'corr-1',
    );
  });

  it('downloads the source from the raw bucket', async () => {
    const { storage, useCase } = makeDeps();

    await useCase.execute(envelope);

    expect(storage.getStream).toHaveBeenCalledWith('fiapx-raw', 'raw/u1/v1.mp4');
  });

  it('publishes video.failed and rethrows so the message is retried', async () => {
    const { extractor, publisher, useCase } = makeDeps();
    extractor.extract.mockRejectedValue(new Error('ffmpeg exited with code 1'));

    await expect(useCase.execute(envelope, 1)).rejects.toThrow('ffmpeg exited with code 1');

    expect(publisher.publish).toHaveBeenCalledWith(
      'video.failed',
      expect.objectContaining({
        videoId: 'v1',
        userEmail: 'user@fiapx.local',
        originalName: 'clip.mp4',
        reason: 'ffmpeg exited with code 1',
        attempt: 1,
      }),
      'corr-1',
    );
  });

  it('fails the video when no frame could be extracted', async () => {
    const { extractor, useCase } = makeDeps();
    extractor.extract.mockResolvedValue({ frameCount: 0, durationMs: 1000 });

    await expect(useCase.execute(envelope)).rejects.toThrow(/nenhum frame/i);
  });

  it('always removes the temporary workspace', async () => {
    const { extractor, workspace, useCase } = makeDeps();
    extractor.extract.mockRejectedValue(new Error('boom'));

    await expect(useCase.execute(envelope)).rejects.toThrow('boom');

    expect(workspace.destroy).toHaveBeenCalledWith('/tmp/job');
  });

  it('removes the temporary workspace on success too', async () => {
    const { workspace, useCase } = makeDeps();

    await useCase.execute(envelope);

    expect(workspace.destroy).toHaveBeenCalledWith('/tmp/job');
  });

  it('skips work when the event was already processed', async () => {
    const { extractor, idempotency, publisher, useCase } = makeDeps();
    idempotency.markProcessed.mockResolvedValue(false);

    await useCase.execute(envelope);

    expect(extractor.extract).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('extracts using the interval carried by the event', async () => {
    const { extractor, useCase } = makeDeps();

    await useCase.execute(
      createEnvelope(ROUTING_KEYS.VIDEO_UPLOADED, { ...payload, frameIntervalSeconds: 5 }),
    );

    expect(extractor.extract).toHaveBeenCalledWith(
      expect.objectContaining({ frameIntervalSeconds: 5 }),
    );
  });

  it('ignores an event type it does not handle', async () => {
    const { extractor, useCase } = makeDeps();

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, payload));

    expect(extractor.extract).not.toHaveBeenCalled();
  });
});
