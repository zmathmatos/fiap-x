import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import type { Logger } from '@fiapx/shared';
import type {
  ExtractFramesInput,
  ExtractFramesResult,
  FrameExtractor,
  VideoMetadata,
} from '../../domain/ports/frame-extractor';
import { UnprocessableVideoError } from '../../domain/errors';
import { buildFfmpegArgs, buildFfprobeArgs, parseFfprobeMetadata } from './build-ffmpeg-args';
import { createProgressReader, FFMPEG_PROGRESS_ARGS } from './ffmpeg-progress';

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
function run(command: string, args: string[], onStdout?: (chunk: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (onStdout) {
        onStdout(text);
        return;
      }
      stdout += text;
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
    // Probing first is what makes the progress percentage possible: without a
    // duration there is nothing to measure ffmpeg's position against.
    const metadata = await this.probe(input.inputPath);

    const readProgress = input.onProgress
      ? createProgressReader(metadata.durationMs, input.onProgress)
      : undefined;

    // ffmpeg reads options positionally: anything after the output path applies to
    // a next output that does not exist, so the progress flags go just before it.
    const args = buildFfmpegArgs(input);
    args.splice(args.length - 1, 0, ...FFMPEG_PROGRESS_ARGS);

    try {
      await run(this.config.ffmpegPath, args, readProgress);
    } catch (error) {
      throw new UnprocessableVideoError(
        error instanceof Error ? error.message : 'ffmpeg não conseguiu decodificar o vídeo',
      );
    }

    const files = await readdir(input.outputDir);
    const frameCount = files.filter((name) => name.endsWith('.jpg')).length;

    this.logger.info({ frameCount, durationMs: metadata.durationMs }, 'frames extracted');
    return { frameCount, metadata };
  }

  private async probe(inputPath: string): Promise<VideoMetadata> {
    try {
      return parseFfprobeMetadata(await run(this.config.ffprobePath, buildFfprobeArgs(inputPath)));
    } catch (error) {
      // Missing metadata is not worth failing the job over — some containers simply
      // do not carry it. Frame extraction still works, only the bar and the detail
      // panel go empty.
      this.logger.warn({ err: error }, 'could not probe video metadata');
      return {
        durationMs: 0,
        codec: null,
        width: null,
        height: null,
        frameRate: null,
        bitrateBps: null,
      };
    }
  }
}
