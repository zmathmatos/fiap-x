import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { WorkspaceFactory } from '../domain/ports/workspace';

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

  openStream(sourcePath) {
    return createReadStream(sourcePath);
  },

  async destroy(root) {
    await rm(root, { recursive: true, force: true });
  },
};
