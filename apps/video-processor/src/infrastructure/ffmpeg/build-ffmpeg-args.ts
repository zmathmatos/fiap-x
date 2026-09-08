import { posix } from 'node:path';
import type { VideoMetadata } from '../../domain/ports/frame-extractor';

export const MIN_FRAME_INTERVAL_SECONDS = 1;
export const MAX_FRAME_INTERVAL_SECONDS = 3600;

/** Frames are written as `frame-00001.jpg`, so they sort correctly inside the zip. */
export const FRAME_PATTERN = 'frame-%05d.jpg';

export interface FfmpegArgsInput {
  inputPath: string;
  outputDir: string;
  frameIntervalSeconds: number;
}

export function buildFfmpegArgs(input: FfmpegArgsInput): string[] {
  const { frameIntervalSeconds } = input;

  if (
    !Number.isInteger(frameIntervalSeconds) ||
    frameIntervalSeconds < MIN_FRAME_INTERVAL_SECONDS ||
    frameIntervalSeconds > MAX_FRAME_INTERVAL_SECONDS
  ) {
    throw new Error(
      `O intervalo entre frames deve ser um inteiro entre ${MIN_FRAME_INTERVAL_SECONDS} e ${MAX_FRAME_INTERVAL_SECONDS} segundos.`,
    );
  }

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-i',
    input.inputPath,
    '-vf',
    `fps=1/${frameIntervalSeconds}`,
    '-q:v',
    '2',
    '-f',
    'image2',
    posix.join(input.outputDir, FRAME_PATTERN),
  ];
}

/**
 * One probe answers everything the detail screen shows: how long the video is,
 * how it was encoded, and how big the picture is. JSON rather than the bare
 * `nokey` form because a single missing field would otherwise shift every value
 * up a line.
 */
export function buildFfprobeArgs(inputPath: string): string[] {
  return [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height,r_frame_rate:format=duration,bit_rate',
    '-print_format',
    'json',
    inputPath,
  ];
}

const UNKNOWN: VideoMetadata = {
  durationMs: 0,
  codec: null,
  width: null,
  height: null,
  frameRate: null,
  bitrateBps: null,
};

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** ffprobe reports frame rate as a rational string such as `30000/1001`. */
function parseFrameRate(value: unknown): number | null {
  if (typeof value !== 'string') return null;

  const [numerator, denominator] = value.split('/');
  const top = Number(numerator);
  const bottom = Number(denominator ?? '1');

  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;

  return Math.round((top / bottom) * 100) / 100;
}

/**
 * Every field is optional on purpose. An exotic container that reports no bitrate
 * is still a perfectly processable video — metadata is for display, so a gap in it
 * must never fail the job.
 */
export function parseFfprobeMetadata(output: string): VideoMetadata {
  let parsed: { streams?: unknown[]; format?: Record<string, unknown> };

  try {
    parsed = JSON.parse(output) as typeof parsed;
  } catch {
    return { ...UNKNOWN };
  }

  const stream = (parsed.streams?.[0] ?? {}) as Record<string, unknown>;
  const format = parsed.format ?? {};

  const durationSeconds = positiveNumber(format.duration);

  return {
    durationMs: durationSeconds === null ? 0 : Math.round(durationSeconds * 1000),
    codec: typeof stream.codec_name === 'string' ? stream.codec_name : null,
    width: positiveNumber(stream.width),
    height: positiveNumber(stream.height),
    frameRate: parseFrameRate(stream.r_frame_rate),
    bitrateBps: positiveNumber(format.bit_rate),
  };
}
