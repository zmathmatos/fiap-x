import busboy from 'busboy';
import type { NextFunction, Request, Response } from 'express';
import { PayloadTooLargeError, ValidationError } from '@fiapx/shared';
import type { UploadVideoUseCase } from '../../../application/use-cases/upload-video';
import type { Video } from '../../../domain/entities/video';
import { requireAuth } from '../middlewares/authenticate';

export interface VideoControllerConfig {
  maxUploadBytes: number;
}

export function presentVideo(video: Video): Record<string, unknown> {
  return {
    id: video.id,
    originalName: video.originalName,
    status: video.status,
    frameCount: video.frameCount,
    durationMs: video.durationMs,
    sizeBytes: video.sizeBytes,
    frameIntervalSeconds: video.frameIntervalSeconds,
    errorReason: video.errorReason,
    downloadable: video.isDownloadable(),
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}

export class VideoController {
  constructor(
    private readonly uploadVideo: UploadVideoUseCase,
    private readonly config: VideoControllerConfig,
  ) {}

  /**
   * Parses the multipart body with busboy and hands the file stream straight to
   * the use case. Multer and friends buffer to disk first; that would double the
   * I/O and put a 500 MB temp file on every API replica.
   */
  upload = (req: Request, res: Response, next: NextFunction): void => {
    const auth = requireAuth(req);

    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: this.config.maxUploadBytes },
      });
    } catch {
      next(new ValidationError('Envie o vídeo como multipart/form-data.'));
      return;
    }

    const fields = new Map<string, string>();
    let handled = false;
    let pending: Promise<Video> | null = null;

    const fail = (error: unknown): void => {
      if (handled) return;
      handled = true;
      req.unpipe(parser);
      next(error);
    };

    parser.on('field', (name, value) => fields.set(name, value));

    parser.on('file', (_name, stream, info) => {
      if (pending) {
        stream.resume();
        return;
      }

      stream.on('limit', () => {
        const megabytes = Math.floor(this.config.maxUploadBytes / (1024 * 1024));
        fail(new PayloadTooLargeError(`O arquivo excede o limite de ${megabytes} MB.`));
      });

      const rawInterval = fields.get('frameIntervalSeconds');
      pending = this.uploadVideo.execute({
        userId: auth.userId,
        userEmail: auth.email,
        originalName: info.filename,
        mimeType: info.mimeType,
        stream,
        correlationId: req.correlationId,
        frameIntervalSeconds: rawInterval === undefined ? undefined : Number(rawInterval),
      });

      pending.catch(() => {
        // Settled below in the `close` handler; this only stops an unhandled
        // rejection while busboy is still draining the request.
      });
    });

    parser.on('error', fail);

    parser.on('close', () => {
      if (handled) return;

      if (!pending) {
        handled = true;
        next(new ValidationError('Nenhum arquivo foi enviado no campo "file".'));
        return;
      }

      pending
        .then((video) => {
          if (handled) return;
          handled = true;
          res.status(202).json(presentVideo(video));
        })
        .catch(fail);
    });

    req.pipe(parser);
  };
}
