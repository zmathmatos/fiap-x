import { Readable } from 'node:stream';
import { createEnvelope, ROUTING_KEYS, createLogger } from '@fiapx/shared';
import { ProcessVideoUseCase } from '../../src/application/process-video';
import { UnprocessableVideoError } from '../../src/domain/errors';

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

  const metadata = {
    durationMs: 180_000,
    codec: 'h264',
    width: 1920,
    height: 1080,
    frameRate: 29.97,
    bitrateBps: 8_500_000,
  };

  const extractor = {
    extract: jest.fn().mockResolvedValue({ frameCount: 9, metadata }),
  };

  const zipArchiver = { archive: jest.fn().mockReturnValue(Readable.from(['zip-bytes'])) };
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const idempotency = {
    wasProcessed: jest.fn().mockResolvedValue(false),
    markProcessed: jest.fn().mockResolvedValue(true),
  };
  const progress = { report: jest.fn().mockResolvedValue(undefined), read: jest.fn() };
  const workspace = {
    create: jest.fn().mockResolvedValue({
      root: '/tmp/job',
      inputPath: '/tmp/job/in.mp4',
      framesDir: '/tmp/job/frames',
    }),
    saveStream: jest.fn().mockResolvedValue(undefined),
    openStream: jest.fn().mockReturnValue(Readable.from(['jpeg-bytes'])),
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  const metrics = {
    startTimer: jest.fn().mockReturnValue(jest.fn()),
    videoProcessed: jest.fn(),
    videoFailed: jest.fn(),
  };

  const useCase = new ProcessVideoUseCase({
    storage,
    extractor,
    zipArchiver,
    publisher,
    idempotency,
    progress,
    workspace,
    metrics,
    logger: createLogger('test'),
    config: { bucketRaw: 'fiapx-raw', bucketZips: 'fiapx-zips' },
  });

  return {
    storage,
    extractor,
    zipArchiver,
    publisher,
    idempotency,
    progress,
    workspace,
    metrics,
    useCase,
    metadata,
  };
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
        codec: 'h264',
        width: 1920,
        height: 1080,
        frameRate: 29.97,
        bitrateBps: 8_500_000,
        thumbnailKey: 'thumbs/u1/v1.jpg',
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

  it('does not put an undecodable video back on the retry ladder', async () => {
    const { extractor, publisher, idempotency, useCase } = makeDeps();
    extractor.extract.mockRejectedValue(
      new UnprocessableVideoError('arquivo não pôde ser decodificado'),
    );

    await expect(useCase.execute(envelope, 1)).resolves.toBeUndefined();

    expect(publisher.publish).toHaveBeenCalledWith(
      'video.failed',
      expect.objectContaining({ videoId: 'v1', reason: 'arquivo não pôde ser decodificado' }),
      'corr-1',
    );
    expect(idempotency.markProcessed).toHaveBeenCalledWith(envelope.eventId);
  });

  it('fails the video when no frame could be extracted', async () => {
    const { extractor, useCase } = makeDeps();
    extractor.extract.mockResolvedValue({
      frameCount: 0,
      metadata: {
        durationMs: 1000,
        codec: null,
        width: null,
        height: null,
        frameRate: null,
        bitrateBps: null,
      },
    });

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
    idempotency.wasProcessed.mockResolvedValue(true);

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

  it('writes the percentages the extractor reports to the progress store', async () => {
    const { extractor, progress, useCase } = makeDeps();
    extractor.extract.mockImplementation(async (input: { onProgress?: (p: number) => void }) => {
      input.onProgress?.(10);
      input.onProgress?.(70);
      return {
        frameCount: 9,
        metadata: {
          durationMs: 1,
          codec: null,
          width: null,
          height: null,
          frameRate: null,
          bitrateBps: null,
        },
      };
    });

    await useCase.execute(envelope);

    expect(progress.report).toHaveBeenCalledWith('v1', 10);
    expect(progress.report).toHaveBeenCalledWith('v1', 70);
  });

  it('finishes the video even when the progress store is unreachable', async () => {
    const { extractor, progress, publisher, useCase } = makeDeps();
    progress.report.mockRejectedValue(new Error('redis down'));
    extractor.extract.mockImplementation(async (input: { onProgress?: (p: number) => void }) => {
      input.onProgress?.(50);
      return {
        frameCount: 9,
        metadata: {
          durationMs: 1,
          codec: null,
          width: null,
          height: null,
          frameRate: null,
          bitrateBps: null,
        },
      };
    });

    await useCase.execute(envelope);

    expect(publisher.publish).toHaveBeenCalledWith(
      'video.processed',
      expect.objectContaining({ videoId: 'v1' }),
      'corr-1',
    );
  });

  it('keeps the first extracted frame as the poster and announces its key', async () => {
    const { storage, workspace, publisher, useCase } = makeDeps();

    await useCase.execute(envelope);

    expect(workspace.openStream).toHaveBeenCalledWith('/tmp/job/frames/frame-00001.jpg');
    expect(storage.putStream).toHaveBeenCalledWith(
      'fiapx-zips',
      'thumbs/u1/v1.jpg',
      expect.anything(),
      'image/jpeg',
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      'video.processed',
      expect.objectContaining({ thumbnailKey: 'thumbs/u1/v1.jpg' }),
      'corr-1',
    );
  });

  it('still finishes the video when the poster cannot be stored', async () => {
    const { storage, workspace, publisher, useCase } = makeDeps();
    workspace.openStream.mockImplementation(() => {
      throw new Error('frame missing');
    });

    await useCase.execute(envelope);

    expect(publisher.publish).toHaveBeenCalledWith(
      'video.processed',
      expect.objectContaining({ thumbnailKey: null }),
      'corr-1',
    );
    expect(storage.putStream).toHaveBeenCalledWith(
      'fiapx-zips',
      'zips/u1/v1.zip',
      expect.anything(),
      'application/zip',
    );
  });

  it('ignores an event type it does not handle', async () => {
    const { extractor, useCase } = makeDeps();

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, payload));

    expect(extractor.extract).not.toHaveBeenCalled();
  });
});
