import type { ProgressStore } from '@fiapx/shared';

/**
 * Makes reading progress safe to call from anywhere.
 *
 * Progress is decoration: a listing that cannot reach Redis is still a correct
 * listing. Keeping the fallback in one decorator means no use case has to
 * remember to guard its own read.
 */
export function withProgressFallback(inner: ProgressStore): ProgressStore {
  return {
    report: (videoId, percent) => inner.report(videoId, percent),

    async read(videoIds) {
      try {
        return await inner.read(videoIds);
      } catch {
        return new Map();
      }
    },
  };
}
