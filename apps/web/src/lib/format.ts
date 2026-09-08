export function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number): string => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const decimals = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

export function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('pt-BR').format(value);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
];

/** "há 3 minutos" — clearer than a timestamp for things that just happened. */
export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const elapsedMs = new Date(isoDate).getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  let value = elapsedMs / 1000;
  for (const [unit, step] of RELATIVE_UNITS) {
    if (Math.abs(value) < step) {
      return formatter.format(Math.round(value), unit);
    }
    value /= step;
  }

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(isoDate));
}

export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

const DASH = '—';

export function formatResolution(width: number | null, height: number | null): string {
  return width === null || height === null ? DASH : `${width}×${height}`;
}

export function formatFrameRate(fps: number | null): string {
  if (fps === null || fps <= 0) return DASH;

  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(fps)} fps`;
}

/** Mbps once the number would otherwise run to four digits of kbps. */
export function formatBitrate(bitsPerSecond: number | null): string {
  if (bitsPerSecond === null || bitsPerSecond <= 0) return DASH;

  const format = (value: number): string =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);

  return bitsPerSecond >= 1_000_000
    ? `${format(bitsPerSecond / 1_000_000)} Mbps`
    : `${format(bitsPerSecond / 1000)} kbps`;
}
