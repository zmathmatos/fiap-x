import { VideoStatus, canTransition, isTerminal } from '../../src/domain/entities/video-status';

describe('canTransition', () => {
  it('allows the happy path', () => {
    expect(canTransition(VideoStatus.PENDING, VideoStatus.PROCESSING)).toBe(true);
    expect(canTransition(VideoStatus.PROCESSING, VideoStatus.COMPLETED)).toBe(true);
    expect(canTransition(VideoStatus.PROCESSING, VideoStatus.FAILED)).toBe(true);
  });

  it('allows failing straight from pending', () => {
    expect(canTransition(VideoStatus.PENDING, VideoStatus.FAILED)).toBe(true);
  });

  it('rejects moving out of a terminal state', () => {
    expect(canTransition(VideoStatus.COMPLETED, VideoStatus.PROCESSING)).toBe(false);
    expect(canTransition(VideoStatus.FAILED, VideoStatus.COMPLETED)).toBe(false);
    expect(canTransition(VideoStatus.COMPLETED, VideoStatus.FAILED)).toBe(false);
  });

  it('rejects skipping processing', () => {
    expect(canTransition(VideoStatus.PENDING, VideoStatus.COMPLETED)).toBe(false);
  });

  it('rejects staying in the same state', () => {
    expect(canTransition(VideoStatus.PROCESSING, VideoStatus.PROCESSING)).toBe(false);
  });
});

describe('isTerminal', () => {
  it('marks completed and failed as terminal', () => {
    expect(isTerminal(VideoStatus.COMPLETED)).toBe(true);
    expect(isTerminal(VideoStatus.FAILED)).toBe(true);
  });

  it('marks pending and processing as non-terminal', () => {
    expect(isTerminal(VideoStatus.PENDING)).toBe(false);
    expect(isTerminal(VideoStatus.PROCESSING)).toBe(false);
  });
});
