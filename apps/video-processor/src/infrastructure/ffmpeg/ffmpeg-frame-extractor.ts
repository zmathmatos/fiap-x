import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import type { Logger } from '@fiapx/shared';
import type {
  ExtractFramesInput,
  ExtractFramesResult,
  FrameExtractor,
} from '../../domain/ports/frame-extractor';
import { buildFfmpegArgs, buildFfprobeArgs } from './build-ffmpeg-args';

export interface FfmpegConfig {
  ffmpegPath: string;
  ffprobePath: string;
}

/**
 * Runs a binary and resolves with its stdout.
 *
 * `spawn` with an argument array, never `exec`: a filename is user-controlled and
 * must never reach a shell.
 */
function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const detail = stderr.trim().split('\n').at(-1) ?? '';
      reject(new Error(`${command} exited with code ${code}${detail ? `: ${detail}` : ''}`));
    });
  });
}

export class FfmpegFrameExtractor implements FrameExtractor {
  constructor(
    private readonly config: FfmpegConfig,
    private readonly logger: Logger,
  ) {}

  async extract(input: ExtractFramesInput): Promise<ExtractFramesResult> {
    const durationMs = await this.probeDurationMs(input.inputPath);

    await run(this.config.ffmpegPath, buildFfmpegArgs(input));

    const files = await readdir(input.outputDir);
    const frameCount = files.filter((name) => name.endsWith('.jpg')).length;

    this.logger.info({ frameCount, durationMs }, 'frames extracted');
    return { frameCount, durationMs };
  }

  private async probeDurationMs(inputPath: string): Promise<number> {
    try {
      const output = await run(this.config.ffprobePath, buildFfprobeArgs(inputPath));
      const seconds = Number.parseFloat(output.trim());
      return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
    } catch (error) {
      // A missing duration is not worth failing the job over — some containers
      // simply do not carry one. Frame extraction still works.
      this.logger.warn({ err: error }, 'could not read video duration');
      return 0;
    }
  }
}
