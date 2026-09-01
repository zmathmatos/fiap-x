import type { Readable } from 'node:stream';

export interface ZipArchiver {
  /** Returns a readable zip of everything in `sourceDir`, built while it is consumed. */
  archive(sourceDir: string): Readable;
}
