import { createEnvelope, ROUTING_KEYS } from '@fiapx/shared';
import { ApplyProcessingEventUseCase } from '../../src/application/use-cases/apply-processing-event';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';
import type { VideoRepository } from '../../src/domain/ports/video-repository';

const processedPayload = {
  videoId: 'v1',
  userEmail: 'user@fiapx.local',
  originalName: 'clip.mp4',
  zipKey: 'zips/u1/v1.zip',
  frameCount: 7,
  durationMs: 140_000,
  sizeBytes: 4096,
};

const failedPayload = {
  videoId: 'v1',
  userEmail: 'user@fiapx.local',
  originalName: 'clip.mp4',
  reason: 'ffmpeg exited with code 1',
  attempt: 3,
};

function pendingVideo(): Video {
  return new Video({
    id: 'v1',
    userId: 'u1',
    originalName: 'clip.mp4',
    storageKey: 'raw/u1/v1.mp4',
    status: VideoStatus.PENDING,
    frameIntervalSeconds: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeDeps(video: Video | null = pendingVideo()) {
  const repo = {
    findById: jest.fn().mockResolvedValue(video),
    save: jest.fn().mockImplementation(async (v) => v),
    appendEvent: jest.fn().mockResolvedValue(undefined),
    findByIdForUser: jest.fn(),
    listByUser: jest.fn(),
    listEvents: jest.fn(),
  } as unknown as jest.Mocked<VideoRepository>;

  const idempotency = {
    wasProcessed: jest.fn().mockResolvedValue(false),
    markProcessed: jest.fn().mockResolvedValue(true),
  };

  return { repo, idempotency, useCase: new ApplyProcessingEventUseCase(repo, idempotency) };
}

describe('ApplyProcessingEventUseCase', () => {
  it('ignores an event whose id was already processed', async () => {
    const { repo, idempotency, useCase } = makeDeps();
    idempotency.wasProcessed.mockResolvedValue(true);

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, processedPayload));

    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.appendEvent).not.toHaveBeenCalled();
  });

  it('moves the video to PROCESSING on video.processing.started', async () => {
    const { repo, useCase } = makeDeps();

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSING_STARTED, { videoId: 'v1' }));

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: VideoStatus.PROCESSING }),
    );
  });

  it('stores the zip metadata on video.processed', async () => {
    const video = pendingVideo();
    video.markProcessing();
    const { repo, useCase } = makeDeps(video);

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, processedPayload));

    const saved = repo.save.mock.calls.at(-1)?.[0];
    expect(saved?.status).toBe(VideoStatus.COMPLETED);
    expect(saved?.zipKey).toBe('zips/u1/v1.zip');
    expect(saved?.frameCount).toBe(7);
    expect(saved?.sizeBytes).toBe(4096);
  });

  it('stores the reason on video.failed', async () => {
    const { repo, useCase } = makeDeps();

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload));

    const saved = repo.save.mock.calls.at(-1)?.[0];
    expect(saved?.status).toBe(VideoStatus.FAILED);
    expect(saved?.errorReason).toBe('ffmpeg exited with code 1');
  });

  it('does nothing when the video no longer exists', async () => {
    const { repo, useCase } = makeDeps(null);

    await expect(
      useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload)),
    ).resolves.toBeUndefined();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('appends every applied event to the video timeline', async () => {
    const { repo, useCase } = makeDeps();

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failedPayload));

    expect(repo.appendEvent).toHaveBeenCalledWith('v1', 'video.failed', failedPayload);
  });

  it('skips an event type it does not own', async () => {
    const { repo, useCase } = makeDeps();

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_UPLOADED, { videoId: 'v1' }));

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does not save when the transition is rejected by the state machine', async () => {
    const completed = pendingVideo();
    completed.markProcessing();
    completed.markCompleted({ zipKey: 'z', frameCount: 1, durationMs: 1, sizeBytes: 1 });
    const { repo, useCase } = makeDeps(completed);

    await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSING_STARTED, { videoId: 'v1' }));

    expect(repo.save).not.toHaveBeenCalled();
  });
});
