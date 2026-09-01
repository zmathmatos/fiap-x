import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';

function makeVideo(): Video {
  return new Video({
    id: 'v1',
    userId: 'u1',
    originalName: 'clip.mp4',
    storageKey: 'raw/u1/v1.mp4',
    status: VideoStatus.PENDING,
    frameIntervalSeconds: 20,
    createdAt: new Date('2026-09-01T12:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
  });
}

describe('Video', () => {
  it('moves to processing', () => {
    const video = makeVideo();
    expect(video.markProcessing()).toBe(true);
    expect(video.status).toBe(VideoStatus.PROCESSING);
  });

  it('records the result when completed', () => {
    const video = makeVideo();
    video.markProcessing();

    expect(
      video.markCompleted({
        zipKey: 'zips/u1/v1.zip',
        frameCount: 12,
        durationMs: 240_000,
        sizeBytes: 900,
      }),
    ).toBe(true);

    expect(video.status).toBe(VideoStatus.COMPLETED);
    expect(video.zipKey).toBe('zips/u1/v1.zip');
    expect(video.frameCount).toBe(12);
    expect(video.durationMs).toBe(240_000);
    expect(video.sizeBytes).toBe(900);
    expect(video.isDownloadable()).toBe(true);
  });

  it('records the reason when failed', () => {
    const video = makeVideo();

    expect(video.markFailed('ffmpeg exited with code 1')).toBe(true);

    expect(video.status).toBe(VideoStatus.FAILED);
    expect(video.errorReason).toBe('ffmpeg exited with code 1');
    expect(video.isDownloadable()).toBe(false);
  });

  it('ignores an out-of-order transition instead of throwing', () => {
    const video = makeVideo();
    video.markProcessing();
    video.markCompleted({ zipKey: 'z', frameCount: 1, durationMs: 1, sizeBytes: 1 });

    expect(video.markProcessing()).toBe(false);
    expect(video.status).toBe(VideoStatus.COMPLETED);
  });

  it('does not overwrite the result when a duplicate completion arrives', () => {
    const video = makeVideo();
    video.markProcessing();
    video.markCompleted({ zipKey: 'first.zip', frameCount: 5, durationMs: 10, sizeBytes: 20 });

    video.markCompleted({ zipKey: 'second.zip', frameCount: 99, durationMs: 99, sizeBytes: 99 });

    expect(video.zipKey).toBe('first.zip');
    expect(video.frameCount).toBe(5);
  });

  it('is not downloadable while completed but missing a zip key', () => {
    const video = makeVideo();
    video.markProcessing();
    expect(video.isDownloadable()).toBe(false);
  });

  it('bumps updatedAt on every accepted transition', () => {
    const video = makeVideo();
    const before = video.updatedAt.getTime();

    video.markProcessing();

    expect(video.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
