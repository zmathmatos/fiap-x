import { Readable } from 'node:stream';
import { ValidationError } from '@fiapx/shared';
import { UploadVideoUseCase } from '../../src/application/use-cases/upload-video';
import { VideoStatus } from '../../src/domain/entities/video-status';
import type { VideoRepository } from '../../src/domain/ports/video-repository';

function makeDeps() {
  const repo = {
    save: jest.fn().mockImplementation(async (video) => video),
    appendEvent: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findByIdForUser: jest.fn(),
    listByUser: jest.fn(),
    listEvents: jest.fn(),
  } as unknown as jest.Mocked<VideoRepository>;

  const storage = {
    putStream: jest.fn().mockResolvedValue({ sizeBytes: 1024 }),
    getStream: jest.fn(),
    head: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
    ensureBuckets: jest.fn(),
    isHealthy: jest.fn(),
  };

  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const useCase = new UploadVideoUseCase(repo, storage, publisher, {
    bucketRaw: 'fiapx-raw',
    defaultFrameIntervalSeconds: 20,
  });

  return { repo, storage, publisher, useCase };
}

function makeInput(overrides: Partial<Parameters<UploadVideoUseCase['execute']>[0]> = {}) {
  return {
    userId: 'u1',
    userEmail: 'user@fiapx.local',
    originalName: 'clip.mp4',
    mimeType: 'video/mp4',
    stream: Readable.from(['fake-bytes']),
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('UploadVideoUseCase', () => {
  it('rejects an unsupported extension before touching storage', async () => {
    const { storage, useCase } = makeDeps();

    await expect(useCase.execute(makeInput({ originalName: 'notes.pdf' }))).rejects.toThrow(
      ValidationError,
    );
    expect(storage.putStream).not.toHaveBeenCalled();
  });

  it('accepts every documented container format', async () => {
    for (const name of ['a.mp4', 'b.MOV', 'c.avi', 'd.mkv', 'e.webm']) {
      const { useCase } = makeDeps();
      await expect(useCase.execute(makeInput({ originalName: name }))).resolves.toBeDefined();
    }
  });

  it('stores the object under raw/<userId>/<videoId>.<ext>', async () => {
    const { storage, useCase } = makeDeps();

    const video = await useCase.execute(makeInput());

    expect(storage.putStream).toHaveBeenCalledWith(
      'fiapx-raw',
      `raw/u1/${video.id}.mp4`,
      expect.anything(),
      'video/mp4',
    );
  });

  it('persists the video as PENDING and publishes video.uploaded', async () => {
    const { publisher, useCase } = makeDeps();

    const video = await useCase.execute(makeInput());

    expect(video.status).toBe(VideoStatus.PENDING);
    expect(publisher.publish).toHaveBeenCalledWith(
      'video.uploaded',
      {
        videoId: video.id,
        userId: 'u1',
        userEmail: 'user@fiapx.local',
        storageKey: video.storageKey,
        originalName: 'clip.mp4',
        frameIntervalSeconds: 20,
      },
      'corr-1',
    );
  });

  it('records the upload on the video timeline', async () => {
    const { repo, useCase } = makeDeps();

    const video = await useCase.execute(makeInput());

    expect(repo.appendEvent).toHaveBeenCalledWith(
      video.id,
      'video.uploaded',
      expect.objectContaining({ originalName: 'clip.mp4' }),
    );
  });

  it('marks the video as FAILED when publishing fails, so it never sits stuck in PENDING', async () => {
    const { repo, publisher, useCase } = makeDeps();
    publisher.publish.mockRejectedValueOnce(new Error('broker down'));

    await expect(useCase.execute(makeInput())).rejects.toThrow('broker down');

    const lastSaved = repo.save.mock.calls.at(-1)?.[0];
    expect(lastSaved?.status).toBe(VideoStatus.FAILED);
    expect(lastSaved?.errorReason).toContain('broker down');
  });

  it('falls back to the configured default frame interval', async () => {
    const { useCase } = makeDeps();

    const video = await useCase.execute(makeInput());

    expect(video.frameIntervalSeconds).toBe(20);
  });

  it('honours a per-upload frame interval', async () => {
    const { useCase } = makeDeps();

    const video = await useCase.execute(makeInput({ frameIntervalSeconds: 5 }));

    expect(video.frameIntervalSeconds).toBe(5);
  });

  it('rejects a frame interval outside the allowed range', async () => {
    const { useCase } = makeDeps();

    await expect(useCase.execute(makeInput({ frameIntervalSeconds: 0 }))).rejects.toThrow(
      ValidationError,
    );
    await expect(useCase.execute(makeInput({ frameIntervalSeconds: 3601 }))).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects a file with no extension', async () => {
    const { useCase } = makeDeps();

    await expect(useCase.execute(makeInput({ originalName: 'noextension' }))).rejects.toThrow(
      ValidationError,
    );
  });
});
