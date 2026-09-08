import busboy from 'busboy';
import type { Request } from 'express';
import { PayloadTooLargeError, ValidationError } from '@fiapx/shared';
import type { Readable } from 'node:stream';

export interface UploadedFile {
  filename: string;
  mimeType: string;
  stream: Readable;
  /** Fields the client wrote before the file part. */
  fields: Map<string, string>;
}

export interface MultipartOptions {
  maxUploadBytes: number;
}

/**
 * Hands the first file of a multipart body to `consume` as a live stream.
 *
 * Multer and friends buffer to disk first; that would double the I/O and put a
 * 500 MB temp file on every API replica. Here the bytes go straight from the
 * socket to whatever `consume` pipes them into.
 *
 * `consume` may reject before it ever reads the stream — an unsupported extension
 * is refused on the first line. The stream is drained in that case, because
 * busboy never emits `close` while a file part is unread and the request would
 * hang until the client gave up.
 */
export function readSingleUpload<T>(
  req: Request,
  options: MultipartOptions,
  consume: (file: UploadedFile) => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: options.maxUploadBytes },
      });
    } catch {
      reject(new ValidationError('Envie o vídeo como multipart/form-data.'));
      return;
    }

    const fields = new Map<string, string>();
    let pending: Promise<T> | null = null;
    let settled = false;

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      req.unpipe(parser);
      reject(error);
    };

    parser.on('field', (name, value) => fields.set(name, value));

    parser.on('file', (_name, stream, info) => {
      if (pending) {
        stream.resume();
        return;
      }

      stream.on('limit', () => {
        const megabytes = Math.floor(options.maxUploadBytes / (1024 * 1024));
        fail(new PayloadTooLargeError(`O arquivo excede o limite de ${megabytes} MB.`));
      });

      pending = consume({ filename: info.filename, mimeType: info.mimeType, stream, fields });
      pending.catch(() => stream.resume());
    });

    parser.on('error', fail);

    parser.on('close', () => {
      if (settled) return;

      if (!pending) {
        settled = true;
        reject(new ValidationError('Nenhum arquivo foi enviado no campo "file".'));
        return;
      }

      pending
        .then((result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        })
        .catch(fail);
    });

    req.pipe(parser);
  });
}
