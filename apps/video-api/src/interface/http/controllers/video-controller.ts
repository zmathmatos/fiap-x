import busboy from 'busboy';
import type { NextFunction, Request, Response } from 'express';
import { PayloadTooLargeError, ValidationError } from '@fiapx/shared';
import type { UploadVideoUseCase } from '../../../application/use-cases/upload-video';
import type { ListVideosUseCase } from '../../../application/use-cases/list-videos';
import type { GetVideoUseCase } from '../../../application/use-cases/get-video';
import type { DownloadVideoZipUseCase } from '../../../application/use-cases/download-video-zip';
import { presentVideo } from '../../../application/presenters/video-presenter';
import type { Video } from '../../../domain/entities/video';
import { videosUploadedTotal } from '../../../infrastructure/metrics/registry';
import { requireAuth } from '../middlewares/authenticate';

export interface VideoControllerConfig {
  maxUploadBytes: number;
}

export interface VideoUseCases {
  uploadVideo: UploadVideoUseCase;
  listVideos: ListVideosUseCase;
  getVideo: GetVideoUseCase;
  downloadVideoZip: DownloadVideoZipUseCase;
}

function readQueryString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readQueryNumber(value: unknown): number | undefined {
  const raw = readQueryString(value);
  if (raw === undefined) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class VideoController {
  constructor(
    private readonly useCases: VideoUseCases,
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
      pending = this.useCases.uploadVideo.execute({
        userId: auth.userId,
        userEmail: auth.email,
        originalName: info.filename,
        mimeType: info.mimeType,
        stream,
        correlationId: req.correlationId,
        frameIntervalSeconds: rawInterval === undefined ? undefined : Number(rawInterval),
      });

      pending.catch(() => {
        // The use case can reject before it ever reads the stream — an unsupported
        // extension is rejected on the first line. Nobody would consume the bytes
        // then, busboy would never emit `close`, and the request would hang until
        // the client gave up. Draining here lets the parser finish so the error
        // handler can answer.
        stream.resume();
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
          videosUploadedTotal.inc();
          res.status(202).json(presentVideo(video));
        })
        .catch(fail);
    });

    req.pipe(parser);
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = requireAuth(req);
      res.status(200).json(
        await this.useCases.listVideos.execute({
          userId: auth.userId,
          status: readQueryString(req.query.status),
          search: readQueryString(req.query.search),
          page: readQueryNumber(req.query.page),
          limit: readQueryNumber(req.query.limit),
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = requireAuth(req);
      res.status(200).json(
        await this.useCases.getVideo.execute({
          userId: auth.userId,
          videoId: String(req.params.id),
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = requireAuth(req);
      const result = await this.useCases.downloadVideoZip.execute({
        userId: auth.userId,
        videoId: String(req.params.id),
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(result.sizeBytes));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      );

      // A storage failure mid-stream cannot become a JSON error: the status line is
      // already on the wire, so destroy the response instead of trying to answer.
      result.stream.on('error', (error) => {
        req.log?.error({ err: error }, 'download stream failed');
        res.destroy(error);
      });
      result.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };
}
