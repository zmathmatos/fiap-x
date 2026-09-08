import type { Request, RequestHandler, Response } from 'express';
import { ValidationError } from '@fiapx/shared';
import type { UploadVideoUseCase } from '../../../application/use-cases/upload-video';
import type { ListVideosUseCase } from '../../../application/use-cases/list-videos';
import type { GetVideoUseCase } from '../../../application/use-cases/get-video';
import type { DownloadVideoZipUseCase } from '../../../application/use-cases/download-video-zip';
import type { RenameVideoUseCase } from '../../../application/use-cases/rename-video';
import type { GetVideoThumbnailUseCase } from '../../../application/use-cases/get-video-thumbnail';
import { asyncHandler } from '../async-handler';
import { readSingleUpload } from '../multipart-upload';
import type { VideoMetrics } from '../../../application/ports/metrics';
import { requireAuth } from '../middlewares/authenticate';

export interface VideoControllerConfig {
  maxUploadBytes: number;
}

export interface VideoUseCases {
  uploadVideo: UploadVideoUseCase;
  listVideos: ListVideosUseCase;
  getVideo: GetVideoUseCase;
  downloadVideoZip: DownloadVideoZipUseCase;
  renameVideo: RenameVideoUseCase;
  getVideoThumbnail: GetVideoThumbnailUseCase;
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

function readTitle(body: unknown): string | null {
  const raw = (body as { title?: unknown } | undefined)?.title;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new ValidationError('O nome deve ser um texto.');
  }
  return raw;
}

export class VideoController {
  constructor(
    private readonly useCases: VideoUseCases,
    private readonly config: VideoControllerConfig,
    private readonly metrics: VideoMetrics,
  ) {}

  upload: RequestHandler = asyncHandler(async (req, res) => {
    const auth = requireAuth(req);

    const video = await readSingleUpload(req, this.config, (file) => {
      const rawInterval = file.fields.get('frameIntervalSeconds');
      return this.useCases.uploadVideo.execute({
        userId: auth.userId,
        userEmail: auth.email,
        originalName: file.filename,
        mimeType: file.mimeType,
        stream: file.stream,
        correlationId: req.correlationId,
        frameIntervalSeconds: rawInterval === undefined ? undefined : Number(rawInterval),
        title: file.fields.get('title'),
      });
    });

    this.metrics.uploadAccepted();
    res.status(202).json(video);
  });

  list: RequestHandler = asyncHandler(async (req, res) => {
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
  });

  detail: RequestHandler = asyncHandler(async (req, res) => {
    const auth = requireAuth(req);
    res.status(200).json(
      await this.useCases.getVideo.execute({
        userId: auth.userId,
        videoId: String(req.params.id),
      }),
    );
  });

  rename: RequestHandler = asyncHandler(async (req, res) => {
    const auth = requireAuth(req);
    res.status(200).json(
      await this.useCases.renameVideo.execute({
        userId: auth.userId,
        videoId: String(req.params.id),
        title: readTitle(req.body),
      }),
    );
  });

  thumbnail: RequestHandler = asyncHandler(async (req, res) => {
    const auth = requireAuth(req);
    const result = await this.useCases.getVideoThumbnail.execute({
      userId: auth.userId,
      videoId: String(req.params.id),
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(result.sizeBytes));
    // The poster never changes once written, so it can be cached hard. Private
    // because it is one user's frame, not a public asset.
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');

    this.pipe(req, res, result.stream, 'thumbnail');
  });

  download: RequestHandler = asyncHandler(async (req, res) => {
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

    this.pipe(req, res, result.stream, 'download');
  });

  /**
   * A storage failure mid-stream cannot become a JSON error: the status line is
   * already on the wire, so the response is destroyed instead of answered.
   */
  private pipe(req: Request, res: Response, stream: NodeJS.ReadableStream, what: string): void {
    stream.on('error', (error: Error) => {
      req.log?.error({ err: error }, `${what} stream failed`);
      res.destroy(error);
    });
    stream.pipe(res);
  }
}
