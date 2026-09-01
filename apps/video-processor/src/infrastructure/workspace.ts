import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface JobWorkspace {
  root: string;
  inputPath: string;
  framesDir: string;
}

export interface WorkspaceFactory {
  create(videoId: string, extension: string): Promise<JobWorkspace>;
  saveStream(destinationPath: string, source: Readable): Promise<void>;
  destroy(root: string): Promise<void>;
}

/**
 * Scratch space for one job.
 *
 * Every worker replica gets its own directory per job and deletes it afterwards,
 * so a crashed pod leaves nothing behind and two replicas never collide.
 */
export const workspaceFactory: WorkspaceFactory = {
  async create(videoId, extension) {
    const root = await mkdtemp(join(tmpdir(), `fiapx-${videoId}-`));
    const framesDir = join(root, 'frames');
    await mkdir(framesDir, { recursive: true });

    return { root, inputPath: join(root, `source.${extension}`), framesDir };
  },

  async saveStream(destinationPath, source) {
    await pipeline(source, createWriteStream(destinationPath));
  },

  async destroy(root) {
    await rm(root, { recursive: true, force: true });
  },
};
