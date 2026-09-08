import { ValidationError } from '@fiapx/shared';

/** Container formats ffmpeg handles reliably in the worker image. */
export const ALLOWED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'] as const;

export type VideoExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** The container a video arrived in, derived from the name the client sent. */
export class VideoFormat {
  private constructor(readonly extension: VideoExtension) {}

  static fromFilename(originalName: string): VideoFormat {
    const parts = originalName.toLowerCase().split('.');
    const extension = parts.length > 1 ? (parts.at(-1) ?? '') : '';

    if (!ALLOWED_EXTENSIONS.includes(extension as VideoExtension)) {
      throw new ValidationError(
        `Formato não suportado. Envie um arquivo ${ALLOWED_EXTENSIONS.join(', ')}.`,
      );
    }
    return new VideoFormat(extension as VideoExtension);
  }
}
