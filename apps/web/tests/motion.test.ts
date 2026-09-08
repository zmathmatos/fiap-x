import { describe, expect, it } from 'vitest';
import { staggerDelay, STAGGER_STEP_S, STAGGER_MAX_S } from '../src/lib/motion';

describe('staggerDelay', () => {
  it('gives the first item no delay so the list starts instantly', () => {
    expect(staggerDelay(0)).toBe(0);
  });

  it('spaces the next items by a fixed step', () => {
    expect(staggerDelay(1)).toBeCloseTo(STAGGER_STEP_S);
    expect(staggerDelay(3)).toBeCloseTo(STAGGER_STEP_S * 3);
  });

  it('caps the cascade so a long page does not keep animating for seconds', () => {
    expect(staggerDelay(500)).toBe(STAGGER_MAX_S);
  });

  it('never returns a negative delay for a bad index', () => {
    expect(staggerDelay(-2)).toBe(0);
  });
});
