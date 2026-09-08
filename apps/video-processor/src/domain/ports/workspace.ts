import type { Readable } from 'node:stream';

export interface JobWorkspace {
  root: string;
  inputPath: string;
  framesDir: string;
}

/**
 * Scratch space for one job.
 *
 * Every worker replica gets its own directory per job and deletes it afterwards,
 * so a crashed pod leaves nothing behind and two replicas never collide.
 */
export interface WorkspaceFactory {
  create(videoId: string, extension: string): Promise<JobWorkspace>;
  saveStream(destinationPath: string, source: Readable): Promise<void>;
  openStream(sourcePath: string): Readable;
  destroy(root: string): Promise<void>;
}
