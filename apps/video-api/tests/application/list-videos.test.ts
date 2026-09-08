import { ValidationError } from '@fiapx/shared';
import { withProgressFallback } from '../../src/infrastructure/progress/resilient-progress-store';
import { ListVideosUseCase } from '../../src/application/use-cases/list-videos';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';
import type { VideoRepository } from '../../src/domain/ports/video-repository';

function makeProgress(entries: [string, number][] = []) {
  return {
    report: jest.fn(),
    read: jest.fn().mockResolvedValue(new Map(entries)),
  };
}

function makeRepo() {
  return {
    listByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn(),
    findById: jest.fn(),
    findByIdForUser: jest.fn(),
    appendEvent: jest.fn(),
    listEvents: jest.fn(),
  } as unknown as jest.Mocked<VideoRepository>;
}

describe('ListVideosUseCase', () => {
  it('applies sane defaults for page and limit', async () => {
    const repo = makeRepo();
    await new ListVideosUseCase(repo, makeProgress()).execute({ userId: 'u1' });

    expect(repo.listByUser).toHaveBeenCalledWith('u1', {
      status: undefined,
      search: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('clamps limit to 100 and page to at least 1', async () => {
    const repo = makeRepo();
    await new ListVideosUseCase(repo, makeProgress()).execute({
      userId: 'u1',
      limit: 5000,
      page: 0,
    });

    expect(repo.listByUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ page: 1, limit: 100 }),
    );
  });

  it('rejects an unknown status filter', async () => {
    await expect(
      new ListVideosUseCase(makeRepo(), makeProgress()).execute({ userId: 'u1', status: 'BANANA' }),
    ).rejects.toThrow(ValidationError);
  });

  it('accepts a known status filter', async () => {
    const repo = makeRepo();
    await new ListVideosUseCase(repo, makeProgress()).execute({ userId: 'u1', status: 'FAILED' });

    expect(repo.listByUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ status: VideoStatus.FAILED }),
    );
  });

  it('returns the presented items alongside the pagination data', async () => {
    const repo = makeRepo();
    const video = new Video({
      id: 'v1',
      userId: 'u1',
      originalName: 'clip.mp4',
      storageKey: 'raw/u1/v1.mp4',
      status: VideoStatus.PENDING,
      frameIntervalSeconds: 20,
      createdAt: new Date('2026-09-01T12:00:00Z'),
      updatedAt: new Date('2026-09-01T12:00:00Z'),
    });
    repo.listByUser.mockResolvedValue({ items: [video], total: 1 });

    const result = await new ListVideosUseCase(repo, makeProgress()).execute({ userId: 'u1' });

    expect(result).toEqual({
      items: [expect.objectContaining({ id: 'v1', status: 'PENDING', downloadable: false })],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('trims an empty search into no filter at all', async () => {
    const repo = makeRepo();
    await new ListVideosUseCase(repo, makeProgress()).execute({ userId: 'u1', search: '   ' });

    expect(repo.listByUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ search: undefined }),
    );
  });

  it('attaches the live progress to a video that is still processing', async () => {
    const repo = makeRepo();
    const processing = new Video({
      id: 'v1',
      userId: 'u1',
      originalName: 'clip.mp4',
      storageKey: 'raw/u1/v1.mp4',
      status: VideoStatus.PROCESSING,
      frameIntervalSeconds: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repo.listByUser.mockResolvedValue({ items: [processing], total: 1 });
    const progress = makeProgress([['v1', 63]]);

    const output = await new ListVideosUseCase(repo, progress).execute({ userId: 'u1' });

    expect(progress.read).toHaveBeenCalledWith(['v1']);
    expect(output.items[0]?.progressPercent).toBe(63);
  });

  it('does not ask redis about videos that are already finished', async () => {
    const repo = makeRepo();
    repo.listByUser.mockResolvedValue({
      items: [
        new Video({
          id: 'done',
          userId: 'u1',
          originalName: 'clip.mp4',
          storageKey: 'raw/u1/done.mp4',
          status: VideoStatus.COMPLETED,
          frameIntervalSeconds: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ],
      total: 1,
    });
    const progress = makeProgress();

    await new ListVideosUseCase(repo, progress).execute({ userId: 'u1' });

    expect(progress.read).toHaveBeenCalledWith([]);
  });

  it('still lists the videos when redis is unreachable', async () => {
    const repo = makeRepo();
    repo.listByUser.mockResolvedValue({
      items: [
        new Video({
          id: 'v1',
          userId: 'u1',
          originalName: 'clip.mp4',
          storageKey: 'raw/u1/v1.mp4',
          status: VideoStatus.PROCESSING,
          frameIntervalSeconds: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ],
      total: 1,
    });
    const progress = makeProgress();
    progress.read.mockRejectedValue(new Error('redis down'));

    const output = await new ListVideosUseCase(repo, withProgressFallback(progress)).execute({
      userId: 'u1',
    });

    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.progressPercent).toBeNull();
  });
});
