import { ValidationError } from '@fiapx/shared';

export const MIN_FRAME_INTERVAL_SECONDS = 1;
export const MAX_FRAME_INTERVAL_SECONDS = 3600;

/** How many seconds of video separate two extracted frames. */
export class FrameInterval {
  private constructor(readonly seconds: number) {}

  static of(seconds: number): FrameInterval {
    if (
      !Number.isInteger(seconds) ||
      seconds < MIN_FRAME_INTERVAL_SECONDS ||
      seconds > MAX_FRAME_INTERVAL_SECONDS
    ) {
      throw new ValidationError(
        `O intervalo entre frames deve estar entre ${MIN_FRAME_INTERVAL_SECONDS} e ${MAX_FRAME_INTERVAL_SECONDS} segundos.`,
      );
    }
    return new FrameInterval(seconds);
  }
}
