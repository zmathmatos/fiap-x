import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { BASE_URL } from './world';

setDefaultTimeout(120_000);

export const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

/**
 * Builds the sample videos with ffmpeg the first time they are needed, so the
 * repository does not carry binary fixtures.
 */
function ensureFixtures(): void {
  if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });

  const sample = join(FIXTURES_DIR, 'sample.mp4');
  if (!existsSync(sample)) {
    const result = spawnSync(
      process.env.FFMPEG_PATH ?? 'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=320x240:rate=10',
        '-t',
        '6',
        '-pix_fmt',
        'yuv420p',
        sample,
      ],
      { stdio: 'inherit' },
    );

    if (result.status !== 0) {
      throw new Error(
        'ffmpeg é necessário para gerar as fixtures do BDD. Instale-o ou defina FFMPEG_PATH.',
      );
    }
  }

  const corrupted = join(FIXTURES_DIR, 'corrupted.mp4');
  if (!existsSync(corrupted)) {
    // Random bytes with a video extension: accepted at upload, impossible to decode.
    writeFileSync(corrupted, Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37) % 256)));
  }

  const notes = join(FIXTURES_DIR, 'notes.pdf');
  if (!existsSync(notes)) {
    writeFileSync(notes, '%PDF-1.4\n% fixture do BDD\n');
  }
}

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health/ready`);
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `A API não ficou pronta em ${BASE_URL}. Suba o ambiente com "make up" antes de rodar o BDD.`,
  );
}

BeforeAll(async () => {
  ensureFixtures();
  await waitForApi();
});
