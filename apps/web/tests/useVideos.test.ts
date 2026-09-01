import { describe, expect, it } from 'vitest';
import { pollIntervalFor, FAST_POLL_MS, SLOW_POLL_MS } from '../src/features/videos/useVideos';

describe('pollIntervalFor', () => {
  it('polls fast while anything is pending or processing', () => {
    expect(pollIntervalFor([{ status: 'PROCESSING' }, { status: 'COMPLETED' }])).toBe(FAST_POLL_MS);
    expect(pollIntervalFor([{ status: 'PENDING' }])).toBe(FAST_POLL_MS);
  });

  it('backs off when everything reached a terminal state', () => {
    expect(pollIntervalFor([{ status: 'COMPLETED' }, { status: 'FAILED' }])).toBe(SLOW_POLL_MS);
  });

  it('backs off on an empty library', () => {
    expect(pollIntervalFor([])).toBe(SLOW_POLL_MS);
  });
});
