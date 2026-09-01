import {
  buildFfmpegArgs,
  buildFfprobeArgs,
} from '../../src/infrastructure/ffmpeg/build-ffmpeg-args';

describe('buildFfmpegArgs', () => {
  it('extracts one frame every N seconds as jpeg', () => {
    const args = buildFfmpegArgs({
      inputPath: '/tmp/in.mp4',
      outputDir: '/tmp/out',
      frameIntervalSeconds: 20,
    });

    expect(args).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-i',
      '/tmp/in.mp4',
      '-vf',
      'fps=1/20',
      '-q:v',
      '2',
      '-f',
      'image2',
      '/tmp/out/frame-%05d.jpg',
    ]);
  });

  it('uses the requested interval in the filter', () => {
    const args = buildFfmpegArgs({
      inputPath: '/tmp/in.mp4',
      outputDir: '/tmp/out',
      frameIntervalSeconds: 5,
    });

    expect(args).toContain('fps=1/5');
  });

  it('rejects a non-positive interval', () => {
    expect(() =>
      buildFfmpegArgs({ inputPath: 'a', outputDir: 'b', frameIntervalSeconds: 0 }),
    ).toThrow(/intervalo/i);
    expect(() =>
      buildFfmpegArgs({ inputPath: 'a', outputDir: 'b', frameIntervalSeconds: -3 }),
    ).toThrow(/intervalo/i);
  });

  it('rejects a fractional interval', () => {
    expect(() =>
      buildFfmpegArgs({ inputPath: 'a', outputDir: 'b', frameIntervalSeconds: 1.5 }),
    ).toThrow(/intervalo/i);
  });

  it('rejects an interval above one hour', () => {
    expect(() =>
      buildFfmpegArgs({ inputPath: 'a', outputDir: 'b', frameIntervalSeconds: 3601 }),
    ).toThrow(/intervalo/i);
  });
});

describe('buildFfprobeArgs', () => {
  it('asks only for the duration, in a parseable form', () => {
    expect(buildFfprobeArgs('/tmp/in.mp4')).toEqual([
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      '/tmp/in.mp4',
    ]);
  });
});
