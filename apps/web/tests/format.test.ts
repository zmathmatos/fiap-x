import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCount,
  formatDuration,
  formatRelativeTime,
} from '../src/lib/format';

describe('formatDuration', () => {
  it('renders minutes and seconds', () => {
    expect(formatDuration(140_000)).toBe('2:20');
  });

  it('renders hours when the video is long', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('renders an em dash when there is no duration', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(0)).toBe('—');
  });
});

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5_242_880)).toBe('5.0 MB');
  });

  it('drops the decimal for large values in a unit', () => {
    expect(formatBytes(157_286_400)).toBe('150 MB');
  });

  it('renders an em dash when unknown', () => {
    expect(formatBytes(null)).toBe('—');
  });
});

describe('formatCount', () => {
  it('groups thousands in pt-BR', () => {
    expect(formatCount(1234)).toBe('1.234');
  });

  it('renders an em dash when unknown', () => {
    expect(formatCount(null)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-01T12:00:00Z');

  it('describes something that just happened', () => {
    expect(formatRelativeTime('2026-09-01T11:58:00Z', now)).toContain('2 min');
  });

  it('falls back to a date for old entries', () => {
    expect(formatRelativeTime('2026-07-01T12:00:00Z', now)).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
