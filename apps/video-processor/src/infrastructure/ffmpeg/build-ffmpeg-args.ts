import { posix } from 'node:path';

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

export function buildFfprobeArgs(inputPath: string): string[] {
  return [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ];
}
