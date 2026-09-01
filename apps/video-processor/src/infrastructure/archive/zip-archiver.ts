import type { Readable } from 'node:stream';
import archiver from 'archiver';
import type { ZipArchiver } from '../../domain/ports/archiver';

export class NodeZipArchiver implements ZipArchiver {
  archive(sourceDir: string): Readable {
    // Level 6 is the useful middle ground: JPEG frames barely compress, so a
    // higher level would burn CPU on the worker for almost no size gain.
    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.directory(sourceDir, false);
    void archive.finalize();

    return archive;
  }
}
