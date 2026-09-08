import { ValidationError } from '@fiapx/shared';
import { FrameInterval } from '../../src/domain/value-objects/frame-interval';
import { VideoFormat } from '../../src/domain/value-objects/video-format';
import { VideoTitle, MAX_TITLE_LENGTH } from '../../src/domain/value-objects/video-title';

describe('VideoTitle', () => {
  it('trims the value the user typed', () => {
    expect(VideoTitle.of('  Aula 02  ')?.value).toBe('Aula 02');
  });

  it('treats blank as absent, which is what clears a title', () => {
    expect(VideoTitle.of('   ')).toBeNull();
    expect(VideoTitle.of(null)).toBeNull();
    expect(VideoTitle.of(undefined)).toBeNull();
  });

  it('refuses a title longer than the column can hold', () => {
    expect(() => VideoTitle.of('a'.repeat(MAX_TITLE_LENGTH + 1))).toThrow(ValidationError);
  });
});

describe('FrameInterval', () => {
  it('accepts a whole number of seconds inside the range', () => {
    expect(FrameInterval.of(20).seconds).toBe(20);
  });

  it.each([0, -1, 3601, 1.5, Number.NaN])('refuses %p', (value) => {
    expect(() => FrameInterval.of(value)).toThrow(ValidationError);
  });
});

describe('VideoFormat', () => {
  it('reads the container from the file name, case-insensitively', () => {
    expect(VideoFormat.fromFilename('Aula.MP4').extension).toBe('mp4');
  });

  it.each(['notes.txt', 'clip', 'clip.mp4.exe'])('refuses %s', (name) => {
    expect(() => VideoFormat.fromFilename(name)).toThrow(ValidationError);
  });
});
