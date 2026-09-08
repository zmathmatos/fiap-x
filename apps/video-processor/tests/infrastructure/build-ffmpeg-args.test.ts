import {
  buildFfmpegArgs,
  buildFfprobeArgs,
  parseFfprobeMetadata,
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
  it('asks for duration, bitrate and the first video stream as json', () => {
    expect(buildFfprobeArgs('/tmp/in.mp4')).toEqual([
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,width,height,r_frame_rate:format=duration,bit_rate',
      '-print_format',
      'json',
      '/tmp/in.mp4',
    ]);
  });
});

describe('parseFfprobeMetadata', () => {
  const full = JSON.stringify({
    streams: [{ codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30000/1001' }],
    format: { duration: '45.512', bit_rate: '8500000' },
  });

  it('reads every field of a well formed probe', () => {
    expect(parseFfprobeMetadata(full)).toEqual({
      durationMs: 45512,
      codec: 'h264',
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      bitrateBps: 8500000,
    });
  });

  it('resolves the rational frame rate to two decimals', () => {
    const output = JSON.stringify({
      streams: [{ r_frame_rate: '24/1' }],
      format: {},
    });

    expect(parseFfprobeMetadata(output).frameRate).toBe(24);
  });

  it('treats a zero denominator as unknown instead of dividing by it', () => {
    const output = JSON.stringify({ streams: [{ r_frame_rate: '0/0' }], format: {} });

    expect(parseFfprobeMetadata(output).frameRate).toBeNull();
  });

  it('returns nulls for a probe with no video stream rather than throwing', () => {
    expect(parseFfprobeMetadata(JSON.stringify({ streams: [], format: {} }))).toEqual({
      durationMs: 0,
      codec: null,
      width: null,
      height: null,
      frameRate: null,
      bitrateBps: null,
    });
  });

  it('survives output that is not json at all', () => {
    expect(parseFfprobeMetadata('not json').durationMs).toBe(0);
    expect(parseFfprobeMetadata('not json').codec).toBeNull();
  });
});
