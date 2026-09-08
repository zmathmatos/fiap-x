/**
 * Live progress of a video that is still being processed.
 *
 * Progress deliberately does not travel as an event. The worker emits it every
 * couple of seconds, and the API persists every event it consumes into the
 * timeline — routing progress through the broker would bury the three real
 * lifecycle events under hundreds of ticks and put N-workers-times-per-second
 * traffic on the exchange for something purely cosmetic.
 *
 * So it lives in Redis instead: written by the worker, read by the API, expired
 * on its own. Losing it costs a progress bar, never a video.
 */
export interface ProgressStore {
  report(videoId: string, percent: number): Promise<void>;
  read(videoIds: string[]): Promise<Map<string, number>>;
}

/** The two Redis commands this store needs, so tests can pass a stub. */
export interface RedisProgressClient {
  set(key: string, value: string, expiryMode: 'EX', ttlSeconds: number): Promise<'OK' | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
}

export interface ProgressOptions {
  prefix?: string;
  ttlSeconds?: number;
}

const DEFAULT_PREFIX = 'progress';

/**
 * Five minutes outlives any realistic gap between two progress ticks, and expires
 * on its own if a worker dies mid-job — so a crashed job leaves no stale bar.
 */
const DEFAULT_TTL_SECONDS = 300;

export function createRedisProgressStore(
  redis: RedisProgressClient,
  options: ProgressOptions = {},
): ProgressStore {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const keyOf = (videoId: string): string => `${prefix}:${videoId}`;

  return {
    async report(videoId: string, percent: number): Promise<void> {
      const clamped = Math.min(100, Math.max(0, Math.round(percent)));
      await redis.set(keyOf(videoId), String(clamped), 'EX', ttlSeconds);
    },

    async read(videoIds: string[]): Promise<Map<string, number>> {
      const result = new Map<string, number>();
      if (videoIds.length === 0) return result;

      const values = await redis.mget(videoIds.map(keyOf));

      videoIds.forEach((videoId, index) => {
        const raw = values[index];
        if (raw === null || raw === undefined) return;

        const percent = Number(raw);
        if (!Number.isFinite(percent)) return;

        result.set(videoId, percent);
      });

      return result;
    },
  };
}
