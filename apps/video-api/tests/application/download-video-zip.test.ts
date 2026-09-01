import { Readable } from 'node:stream';
import { NotFoundError, ValidationError } from '@fiapx/shared';
import { DownloadVideoZipUseCase } from '../../src/application/use-cases/download-video-zip';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';
import type { VideoRepository } from '../../src/domain/ports/video-repository';

function makeVideo(originalName = 'clip.mp4'): Video {
  return new Video({
    id: 'v1',
    userId: 'u1',
    originalName,
    storageKey: 'raw/u1/v1.mp4',
    status: VideoStatus.PENDING,
    frameIntervalSeconds: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function completed(originalName = 'clip.mp4'): Video {
  const video = makeVideo(originalName);
  video.markProcessing();
  video.markCompleted({
    zipKey: 'zips/u1/v1.zip',
    frameCount: 4,
    durationMs: 80_000,
    sizeBytes: 2048,
  });
  return video;
}

function makeDeps(found: Video | null) {
  const repo = {
    findByIdForUser: jest.fn().mockResolvedValue(found),
    save: jest.fn(),
    findById: jest.fn(),
    listByUser: jest.fn(),
    appendEvent: jest.fn(),
    listEvents: jest.fn(),
  } as unknown as jest.Mocked<VideoRepository>;

  const storage = {
    getStream: jest.fn().mockResolvedValue(Readable.from(['zip'])),
    head: jest.fn().mockResolvedValue({ sizeBytes: 2048 }),
    putStream: jest.fn(),
    remove: jest.fn(),
    ensureBuckets: jest.fn(),
    isHealthy: jest.fn(),
  };

  return {
    repo,
    storage,
    useCase: new DownloadVideoZipUseCase(repo, storage, { bucketZips: 'fiapx-zips' }),
  };
}

describe('DownloadVideoZipUseCase', () => {
  it('throws NotFound when the video belongs to someone else', async () => {
    const { useCase } = makeDeps(null);

    await expect(useCase.execute({ userId: 'u2', videoId: 'v1' })).rejects.toThrow(NotFoundError);
  });

  it('refuses to download a video that is still processing', async () => {
    const { useCase } = makeDeps(makeVideo());

    await expect(useCase.execute({ userId: 'u1', videoId: 'v1' })).rejects.toThrow(ValidationError);
  });

  it('streams the zip from the results bucket', async () => {
    const { storage, useCase } = makeDeps(completed());

    const result = await useCase.execute({ userId: 'u1', videoId: 'v1' });

    expect(storage.getStream).toHaveBeenCalledWith('fiapx-zips', 'zips/u1/v1.zip');
    expect(result.sizeBytes).toBe(2048);
    expect(result.stream).toBeInstanceOf(Readable);
  });

  it('names the zip after the original file', async () => {
    const { useCase } = makeDeps(completed('ferias 2026.mp4'));

    const result = await useCase.execute({ userId: 'u1', videoId: 'v1' });

    expect(result.filename).toBe('ferias 2026-frames.zip');
  });

  it('strips characters that would break the content-disposition header', async () => {
    const { useCase } = makeDeps(completed('re"la/tório\\.mp4'));

    const result = await useCase.execute({ userId: 'u1', videoId: 'v1' });

    expect(result.filename).toBe('re-la-tório--frames.zip');
  });
});
