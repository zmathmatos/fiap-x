import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadWithProgress } from '../src/features/upload/uploadWithProgress';
import { API_BASE, ApiError } from '../src/lib/api-client';

class FakeXhr {
  static last: FakeXhr;

  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = '';
  aborted = false;
  sent = false;

  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: FormData): void {
    this.sent = true;
    this.body = body;
  }

  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }

  respond(status: number, responseText = ''): void {
    this.status = status;
    this.responseText = responseText;
    this.onload?.();
  }

  progress(loaded: number, total: number, lengthComputable = true): void {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
  }
}

function file(name = 'aula.mp4'): File {
  return new File(['conteudo'], name, { type: 'video/mp4' });
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadWithProgress', () => {
  it('posts to the videos endpoint carrying the bearer token', async () => {
    const promise = uploadWithProgress({ file: file(), token: 't0k3n', onProgress: () => undefined });

    const xhr = FakeXhr.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe(`${API_BASE}/videos`);
    expect(xhr.headers.Authorization).toBe('Bearer t0k3n');

    xhr.respond(202, JSON.stringify({ id: 'v1' }));
    await expect(promise).resolves.toEqual({ id: 'v1' });
  });

  it('sends the fields before the file, in the order busboy needs them', async () => {
    const promise = uploadWithProgress({
      file: file(),
      token: 't',
      frameIntervalSeconds: 5,
      title: 'Minha aula',
      onProgress: () => undefined,
    });

    const keys = [...(FakeXhr.last.body as FormData).keys()];
    expect(keys).toEqual(['frameIntervalSeconds', 'title', 'file']);

    FakeXhr.last.respond(202, JSON.stringify({ id: 'v1' }));
    await promise;
  });

  it('omits the optional fields when the caller did not provide them', async () => {
    const promise = uploadWithProgress({ file: file(), token: 't', onProgress: () => undefined });

    expect([...(FakeXhr.last.body as FormData).keys()]).toEqual(['file']);

    FakeXhr.last.respond(202, JSON.stringify({ id: 'v1' }));
    await promise;
  });

  it('reports progress as a rounded percentage', async () => {
    const onProgress = vi.fn();
    const promise = uploadWithProgress({ file: file(), token: 't', onProgress });

    FakeXhr.last.progress(333, 1000);

    expect(onProgress).toHaveBeenCalledWith(33);

    FakeXhr.last.respond(202, JSON.stringify({ id: 'v1' }));
    await promise;
  });

  it('stays quiet while the total size is unknown', async () => {
    const onProgress = vi.fn();
    const promise = uploadWithProgress({ file: file(), token: 't', onProgress });

    FakeXhr.last.progress(10, 0, false);
    FakeXhr.last.progress(10, 0);

    expect(onProgress).not.toHaveBeenCalled();

    FakeXhr.last.respond(202, JSON.stringify({ id: 'v1' }));
    await promise;
  });

  it('surfaces the message the API sent with the rejection', async () => {
    const promise = uploadWithProgress({ file: file(), token: 't', onProgress: () => undefined });

    FakeXhr.last.respond(413, JSON.stringify({ error: { message: 'Arquivo grande demais' } }));

    await expect(promise).rejects.toMatchObject({ message: 'Arquivo grande demais', status: 413 });
  });

  it('falls back to the status code when the body is empty or not json', async () => {
    const empty = uploadWithProgress({ file: file(), token: 't', onProgress: () => undefined });
    FakeXhr.last.respond(500);
    await expect(empty).rejects.toMatchObject({ message: 'Falha no envio (500)', status: 500 });

    const garbage = uploadWithProgress({ file: file(), token: 't', onProgress: () => undefined });
    FakeXhr.last.respond(502, '<html>bad gateway</html>');
    await expect(garbage).rejects.toMatchObject({ message: 'Falha no envio (502)', status: 502 });
  });

  it('rejects when the transport itself fails', async () => {
    const promise = uploadWithProgress({ file: file(), token: 't', onProgress: () => undefined });

    FakeXhr.last.onerror?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ message: 'Falha de rede durante o envio.' });
  });

  it('aborts the request when the caller signals a cancellation', async () => {
    const controller = new AbortController();
    const promise = uploadWithProgress({
      file: file(),
      token: 't',
      onProgress: () => undefined,
      signal: controller.signal,
    });

    controller.abort();

    expect(FakeXhr.last.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ message: 'Envio cancelado.' });
  });

  it('never sends a request that was cancelled before it started', async () => {
    const controller = new AbortController();
    controller.abort();

    const promise = uploadWithProgress({
      file: file(),
      token: 't',
      onProgress: () => undefined,
      signal: controller.signal,
    });

    expect(FakeXhr.last.sent).toBe(false);
    await expect(promise).rejects.toMatchObject({ message: 'Envio cancelado.' });
  });
});
