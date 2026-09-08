import { presentVideo } from '../../src/application/presenters/video-presenter';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';

function makeVideo(status: VideoStatus = VideoStatus.PROCESSING): Video {
  return new Video({
    id: 'v1',
    userId: 'u1',
    originalName: 'clip.mp4',
    storageKey: 'raw/u1/v1.mp4',
    status,
    frameIntervalSeconds: 20,
    createdAt: new Date('2026-09-01T12:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
  });
}

describe('presentVideo', () => {
  it('exposes the probed metadata over the wire', () => {
    const video = makeVideo(VideoStatus.PENDING);
    video.markProcessing();
    video.markCompleted({
      zipKey: 'z.zip',
      frameCount: 4,
      durationMs: 12_000,
      sizeBytes: 34_040,
      codec: 'h264',
      width: 320,
      height: 240,
      frameRate: 10,
      bitrateBps: 28_000,
    });

    expect(presentVideo(video)).toMatchObject({
      codec: 'h264',
      width: 320,
      height: 240,
      frameRate: 10,
      bitrateBps: 28_000,
    });
  });

  it('carries the live progress when one was read for the video', () => {
    expect(presentVideo(makeVideo(), 45).progressPercent).toBe(45);
  });

  it('reports a null progress when nothing is known, rather than guessing zero', () => {
    expect(presentVideo(makeVideo()).progressPercent).toBeNull();
  });
});
