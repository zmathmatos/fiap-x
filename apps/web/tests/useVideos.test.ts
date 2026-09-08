import { describe, expect, it } from 'vitest';
import {
  pollIntervalFor,
  totalPages,
  FAST_POLL_MS,
  SLOW_POLL_MS,
} from '../src/features/videos/useVideos';

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

describe('totalPages', () => {
  it('rounds up so a partial last page still counts', () => {
    expect(totalPages(21, 20)).toBe(2);
  });

  it('reports a single page for an empty library, never zero', () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it('reports exactly one page when the total fills it', () => {
    expect(totalPages(20, 20)).toBe(1);
  });
});
