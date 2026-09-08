import { toDomain, toPersistence } from '../../src/infrastructure/repositories/video-mapper';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';
import type { VideoEntity } from '../../src/infrastructure/database/entities/video.entity';

function makeRow(overrides: Partial<VideoEntity> = {}): VideoEntity {
  return {
    id: 'v1',
    userId: 'u1',
    originalName: 'clip.mp4',
    storageKey: 'raw/u1/v1.mp4',
    zipKey: null,
    status: 'PENDING',
    frameCount: null,
    durationMs: null,
    sizeBytes: null,
    frameIntervalSeconds: 20,
    errorReason: null,
    codec: null,
    width: null,
    height: null,
    frameRate: null,
    bitrateBps: null,
    createdAt: new Date('2026-09-01T12:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
    ...overrides,
  } as VideoEntity;
}

describe('video mapper', () => {
  it('converts the bigint column, which the pg driver returns as a string, into a number', () => {
    const video = toDomain(makeRow({ sizeBytes: '9007199254', status: 'COMPLETED' }));

    expect(video.sizeBytes).toBe(9_007_199_254);
    expect(typeof video.sizeBytes).toBe('number');
  });

  it('keeps a null size as null rather than turning it into zero', () => {
    expect(toDomain(makeRow()).sizeBytes).toBeNull();
    expect(toPersistence(toDomain(makeRow())).sizeBytes).toBeNull();
  });

  it('round-trips a completed video without losing any field', () => {
    const video = toDomain(
      makeRow({
        status: 'COMPLETED',
        zipKey: 'zips/u1/v1.zip',
        frameCount: 42,
        durationMs: 840_000,
        sizeBytes: '123456',
      }),
    );

    const row = toPersistence(video);

    expect(row).toMatchObject({
      id: 'v1',
      userId: 'u1',
      originalName: 'clip.mp4',
      storageKey: 'raw/u1/v1.mp4',
      status: 'COMPLETED',
      zipKey: 'zips/u1/v1.zip',
      frameCount: 42,
      durationMs: 840_000,
      sizeBytes: '123456',
      frameIntervalSeconds: 20,
    });
  });

  it('writes the size back as a string so postgres accepts it as bigint', () => {
    const video = new Video({
      id: 'v1',
      userId: 'u1',
      originalName: 'clip.mp4',
      storageKey: 'raw/u1/v1.mp4',
      status: VideoStatus.PROCESSING,
      frameIntervalSeconds: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    video.markCompleted({ zipKey: 'z.zip', frameCount: 1, durationMs: 2, sizeBytes: 3 });

    expect(toPersistence(video).sizeBytes).toBe('3');
  });

  it('round-trips the probed metadata', () => {
    const video = toDomain(
      makeRow({
        status: 'COMPLETED',
        codec: 'h264',
        width: 1920,
        height: 1080,
        frameRate: '29.97',
        bitrateBps: '8500000',
      }),
    );

    expect(video.frameRate).toBe(29.97);
    expect(video.bitrateBps).toBe(8_500_000);
    expect(toPersistence(video)).toMatchObject({
      codec: 'h264',
      width: 1920,
      height: 1080,
      frameRate: '29.97',
      bitrateBps: '8500000',
    });
  });

  it('carries the failure reason through', () => {
    const video = toDomain(makeRow({ status: 'FAILED', errorReason: 'ffmpeg exited with code 1' }));

    expect(video.status).toBe(VideoStatus.FAILED);
    expect(video.errorReason).toBe('ffmpeg exited with code 1');
    expect(video.isDownloadable()).toBe(false);
  });
});
