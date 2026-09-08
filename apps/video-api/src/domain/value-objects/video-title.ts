import { ValidationError } from '@fiapx/shared';

/** Matches the column width; anything longer would be silently truncated by pg. */
export const MAX_TITLE_LENGTH = 200;

/**
 * The name a user gave a video, as opposed to the name of the file they sent.
 *
 * Absent is a first-class value: `VideoTitle.of('  ')` is `null`, which is what
 * clears a title. The file name is never touched, so a renamed video still
 * downloads under the name it arrived with.
 */
export class VideoTitle {
  private constructor(readonly value: string) {}

  static of(raw: string | null | undefined): VideoTitle | null {
    const trimmed = raw?.trim() ?? '';
    if (trimmed === '') return null;

    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new ValidationError(`O nome deve ter no máximo ${MAX_TITLE_LENGTH} caracteres.`);
    }
    return new VideoTitle(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
