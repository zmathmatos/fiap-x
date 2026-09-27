import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { FIXTURES_DIR } from './hooks';
import { BASE_URL, MAILHOG_URL, type FiapxWorld, type MailhogMessage } from './world';

interface VideoBody {
  id: string;
  status: string;
  errorReason: string | null;
  frameCount: number | null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  pdf: 'application/pdf',
};

const ENCODED_WORD = /=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g;

function decodeMimeWords(header: string): string {
  return header.replace(ENCODED_WORD, (_match, charset: string, encoding: string, text: string) => {
    if (encoding.toUpperCase() === 'B') {
      return Buffer.from(text, 'base64').toString(charset as BufferEncoding);
    }

    const bytes = text
      .replace(/_/g, ' ')
      .replace(/=([0-9A-Fa-f]{2})/g, (_hex, code: string) =>
        String.fromCharCode(parseInt(code, 16)),
      );
    return Buffer.from(bytes, 'binary').toString(charset as BufferEncoding);
  });
}

function fixtureForm(fileName: string): FormData {
  const bytes = readFileSync(join(FIXTURES_DIR, fileName));
  const extension = fileName.split('.').at(-1) ?? '';
  const form = new FormData();

  form.append('frameIntervalSeconds', '1');
  form.append(
    'file',
    new Blob([bytes], { type: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream' }),
    fileName,
  );

  return form;
}

async function upload(world: FiapxWorld, fileName: string): Promise<void> {
  const response = await world.authedFetch('/videos', {
    method: 'POST',
    body: fixtureForm(fileName),
  });

  world.lastStatus = response.status;
  world.lastBody = await response.json().catch(() => null);

  if (response.status === 202) {
    world.videoIds.push((world.lastBody as VideoBody).id);
  }
}

async function readVideo(world: FiapxWorld, videoId: string): Promise<VideoBody> {
  const response = await world.authedFetch(`/videos/${videoId}`);
  world.lastStatus = response.status;

  const body = (await response.json()) as VideoBody;
  world.lastBody = body;
  return body;
}

async function waitForStatus(
  world: FiapxWorld,
  videoId: string,
  expected: string,
  seconds: number,
): Promise<VideoBody> {
  const deadline = Date.now() + seconds * 1000;
  let last: VideoBody | null = null;

  while (Date.now() < deadline) {
    last = await readVideo(world, videoId);
    if (last.status === expected) return last;
    if (last.status === 'COMPLETED' || last.status === 'FAILED') break;

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(
    `O vídeo ${videoId} não chegou em "${expected}" em ${seconds}s (último status: ${last?.status ?? 'desconhecido'}${
      last?.errorReason ? `, motivo: ${last.errorReason}` : ''
    }).`,
  );
}

Given('que existe um usuário autenticado', async function (this: FiapxWorld) {
  await this.createUser();
});

Given('que existem dois usuários autenticados', async function (this: FiapxWorld) {
  await this.createUser();
  await this.createUser();
});

Given('que o primeiro enviou um vídeo', async function (this: FiapxWorld) {
  await upload(this, 'sample.mp4');
  assert.equal(this.lastStatus, 202, 'o upload deveria ter sido aceito');
});

When('ele envia o vídeo {string}', async function (this: FiapxWorld, fileName: string) {
  await upload(this, fileName);
});

When('ele tenta enviar o arquivo {string}', async function (this: FiapxWorld, fileName: string) {
  await upload(this, fileName);
});

When('ele envia {int} vídeos de uma vez', async function (this: FiapxWorld, count: number) {
  await Promise.all(Array.from({ length: count }, () => upload(this, 'sample.mp4')));
});

When('a lista de vídeos é consultada sem token', async function (this: FiapxWorld) {
  const response = await fetch(`${BASE_URL}/videos`);
  this.lastStatus = response.status;
});

When('ele tenta entrar com a senha errada', async function (this: FiapxWorld) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: this.session.email, password: 'senha-errada' }),
  });
  this.lastStatus = response.status;
});

When('o segundo consulta o vídeo do primeiro', async function (this: FiapxWorld) {
  const intruder = this.sessions[1];
  if (!intruder) throw new Error('O cenário precisa de dois usuários.');

  const response = await this.authedFetch(`/videos/${this.videoId}`, {}, intruder);
  this.lastStatus = response.status;
});

Then('a resposta é {int}', function (this: FiapxWorld, expected: number) {
  assert.equal(this.lastStatus, expected);
});

Then('o vídeo aparece com status {string}', async function (this: FiapxWorld, expected: string) {
  const body = await readVideo(this, this.videoId);
  assert.ok(
    body.status === expected || body.status === 'PROCESSING' || body.status === 'COMPLETED',
    `esperava "${expected}" (ou já em andamento), veio "${body.status}"`,
  );
});

Then(
  'em até {int} segundos o status muda para {string}',
  async function (this: FiapxWorld, seconds: number, expected: string) {
    await waitForStatus(this, this.videoId, expected, seconds);
  },
);

Then(
  'em até {int} segundos todos os {int} vídeos estão com status {string}',
  async function (this: FiapxWorld, seconds: number, count: number, expected: string) {
    assert.equal(this.videoIds.length, count, 'nem todos os uploads foram aceitos');

    await Promise.all(
      this.videoIds.map((videoId) => waitForStatus(this, videoId, expected, seconds)),
    );
  },
);

Then(
  'o download retorna um arquivo zip com pelo menos {int} frame',
  async function (this: FiapxWorld, minimum: number) {
    const response = await this.authedFetch(`/videos/${this.videoId}/download`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/zip/);

    const zip = Buffer.from(await response.arrayBuffer());
    this.lastZip = zip;

    // "PK\x03\x04" is the local file header: its presence proves the archive holds
    // at least one entry, without unzipping anything.
    assert.equal(zip.subarray(0, 2).toString('latin1'), 'PK', 'o corpo não é um zip');

    let entries = 0;
    for (let index = 0; index < zip.length - 3; index += 1) {
      if (zip[index] === 0x50 && zip[index + 1] === 0x4b && zip[index + 2] === 0x03) entries += 1;
    }
    assert.ok(
      entries >= minimum,
      `o zip deveria ter ao menos ${minimum} arquivo(s), tem ${entries}`,
    );
  },
);

Then('o motivo da falha é informado', async function (this: FiapxWorld) {
  const body = await readVideo(this, this.videoId);
  assert.equal(body.status, 'FAILED');
  assert.ok(body.errorReason && body.errorReason.length > 0, 'o motivo da falha está vazio');
});

Then(
  'um e-mail sobre {string} é entregue ao usuário',
  async function (this: FiapxWorld, fileName: string) {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const response = await fetch(`${MAILHOG_URL}/api/v2/messages?limit=100`);
      if (response.ok) {
        const inbox = (await response.json()) as { items: MailhogMessage[] };

        const found = inbox.items.some((message) => {
          const to = message.Content.Headers.To?.join(',') ?? '';
          const subject = decodeMimeWords(message.Content.Headers.Subject?.join(' ') ?? '');
          return to.includes(this.session.email) && subject.includes(fileName);
        });

        if (found) return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error(`Nenhum e-mail sobre "${fileName}" chegou para ${this.session.email}.`);
  },
);
