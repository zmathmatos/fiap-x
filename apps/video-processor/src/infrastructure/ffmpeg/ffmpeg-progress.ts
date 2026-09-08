/** Makes ffmpeg write machine-readable progress to stdout instead of a status line. */
export const FFMPEG_PROGRESS_ARGS = ['-progress', 'pipe:1', '-nostats'] as const;

const OUT_TIME_KEY = 'out_time_us=';

/**
 * Reads ffmpeg's `-progress` stream and reports how far along the job is.
 *
 * Emission is gated on the whole percent changing, which is the throttle: a
 * forty-minute video produces at most a hundred writes no matter how chatty
 * ffmpeg is, and no timer is involved, so the behaviour is deterministic.
 *
 * Chunks arrive off a socket and split anywhere, so a partial trailing line is
 * held back until the rest of it shows up.
 */
export function createProgressReader(
  durationMs: number,
  emit: (percent: number) => void,
): (chunk: string) => void {
  let buffer = '';
  let lastPercent = -1;

  return (chunk: string): void => {
    // Without a duration there is no denominator; ffmpeg still runs, the bar just
    // never appears.
    if (durationMs <= 0) return;

    buffer += chunk;

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith(OUT_TIME_KEY)) continue;

      const microseconds = Number(trimmed.slice(OUT_TIME_KEY.length));
      if (!Number.isFinite(microseconds)) continue;

      const percent = Math.min(100, Math.round((microseconds / 1000 / durationMs) * 100));
      if (percent <= lastPercent) continue;

      lastPercent = percent;
      emit(percent);
    }
  };
}
