import type { Transition, Variants } from 'motion/react';

/**
 * One place for every timing in the app.
 *
 * Motion is easy to sprinkle inconsistently — a 200ms fade here, a 450ms one
 * there — and the result reads as jitter rather than design. Screens import these
 * instead of writing numbers inline.
 */

/** Springs, for anything that moves in space. Physical beats eased for position. */
export const SPRING = {
  /** Nav indicator, layout shifts — snappy, barely overshoots. */
  snappy: { type: 'spring', stiffness: 420, damping: 34 },
  /** Progress bars, panels — settles visibly without bouncing. */
  soft: { type: 'spring', stiffness: 180, damping: 26 },
} satisfies Record<string, Transition>;

/** Durations, for opacity and colour, where a spring has nothing to model. */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const STAGGER_STEP_S = 0.04;

/**
 * A hundred rows must not take four seconds to finish arriving. The cascade is a
 * hint that the list has an order, not a queue the reader has to wait out.
 */
export const STAGGER_MAX_S = 0.32;

export function staggerDelay(index: number): number {
  if (index <= 0) return 0;
  return Math.min(STAGGER_MAX_S, index * STAGGER_STEP_S);
}

/** Rise-and-fade, the default entrance for a block of content. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: 'easeOut' } },
  exit: { opacity: 0, y: -6, transition: { duration: DURATION.fast, ease: 'easeIn' } },
};

/** Same idea for a row, which travels a shorter distance so the table stays calm. */
export const rowIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: 'easeOut', delay: staggerDelay(index) },
  }),
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};
