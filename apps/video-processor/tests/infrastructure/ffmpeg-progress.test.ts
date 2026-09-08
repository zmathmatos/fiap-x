import { createProgressReader } from '../../src/infrastructure/ffmpeg/ffmpeg-progress';

const TEN_SECONDS_MS = 10_000;

describe('createProgressReader', () => {
  it('turns out_time_us into a percentage of the known duration', () => {
    const seen: number[] = [];
    const read = createProgressReader(TEN_SECONDS_MS, (percent) => seen.push(percent));

    read('out_time_us=2500000\n');

    expect(seen).toEqual([25]);
  });

  it('emits once per whole percent so a long video cannot flood the store', () => {
    const seen: number[] = [];
    const read = createProgressReader(TEN_SECONDS_MS, (percent) => seen.push(percent));

    read('out_time_us=2500000\n');
    read('out_time_us=2501000\n');
    read('out_time_us=2600000\n');

    expect(seen).toEqual([25, 26]);
  });

  it('reassembles a line split across two chunks', () => {
    const seen: number[] = [];
    const read = createProgressReader(TEN_SECONDS_MS, (percent) => seen.push(percent));

    read('out_time_u');
    read('s=5000000\n');

    expect(seen).toEqual([50]);
  });

  it('ignores the other keys ffmpeg writes in the same block', () => {
    const seen: number[] = [];
    const read = createProgressReader(TEN_SECONDS_MS, (percent) => seen.push(percent));

    read('frame=12\nfps=25\nbitrate=1000kbits/s\nprogress=continue\n');

    expect(seen).toEqual([]);
  });

  it('never reports more than 100 even if ffmpeg overshoots the probed duration', () => {
    const seen: number[] = [];
    const read = createProgressReader(TEN_SECONDS_MS, (percent) => seen.push(percent));

    read('out_time_us=99000000\n');

    expect(seen).toEqual([100]);
  });

  it('stays silent when the duration is unknown, rather than dividing by zero', () => {
    const seen: number[] = [];
    const read = createProgressReader(0, (percent) => seen.push(percent));

    read('out_time_us=2500000\n');

    expect(seen).toEqual([]);
  });

  it('does not go backwards when ffmpeg re-reports an earlier timestamp', () => {
    const seen: number[] = [];
    const read = createProgressReader(TEN_SECONDS_MS, (percent) => seen.push(percent));

    read('out_time_us=5000000\n');
    read('out_time_us=3000000\n');

    expect(seen).toEqual([50]);
  });
});
