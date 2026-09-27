import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadZip } from '../src/lib/download';
import { ApiError } from '../src/lib/api-client';

function zipResponse(headers: Record<string, string> = {}): Response {
  return new Response(new Blob(['zip-bytes']), { status: 200, headers });
}

describe('downloadZip', () => {
  let click: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    click = vi.fn();

    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = click;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends the token in the Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(zipResponse());
    vi.stubGlobal('fetch', fetchMock);

    await downloadZip('video-1', 'token-abc', 'video.zip');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/videos/video-1/download');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
  });

  it('clicks a synthetic link and cleans it up', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(zipResponse()));

    await downloadZip('video-1', 'token', 'video.zip');

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('holds the object url until the browser had time to read it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(zipResponse()));

    await downloadZip('video-1', 'token', 'video.zip');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('falls back to the suggested name when the server sends no disposition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(zipResponse()));
    const setDownload = vi.spyOn(HTMLAnchorElement.prototype, 'download', 'set');

    await downloadZip('video-1', 'token', 'meu-video.zip');

    expect(setDownload).toHaveBeenCalledWith('meu-video.zip');
  });

  it('prefers the utf-8 filename and decodes it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        zipResponse({
          'content-disposition': "attachment; filename=\"fallback.zip\"; filename*=UTF-8''f%C3%A9rias.zip",
        }),
      ),
    );
    const setDownload = vi.spyOn(HTMLAnchorElement.prototype, 'download', 'set');

    await downloadZip('video-1', 'token', 'ignorado.zip');

    expect(setDownload).toHaveBeenCalledWith('férias.zip');
  });

  it('reads the plain filename when there is no utf-8 variant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(zipResponse({ 'content-disposition': 'attachment; filename="frames.zip"' })),
    );
    const setDownload = vi.spyOn(HTMLAnchorElement.prototype, 'download', 'set');

    await downloadZip('video-1', 'token', 'ignorado.zip');

    expect(setDownload).toHaveBeenCalledWith('frames.zip');
  });

  it('surfaces the message the API sent with the failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'O zip expirou.' } }), { status: 410 }),
      ),
    );

    await expect(downloadZip('video-1', 'token', 'video.zip')).rejects.toThrow('O zip expirou.');
  });

  it('falls back to a generic message when the failure has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    await expect(downloadZip('video-1', 'token', 'video.zip')).rejects.toMatchObject({
      message: 'Não foi possível baixar o arquivo.',
      status: 500,
    });
  });

  it('raises an ApiError so callers can read the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));

    await expect(downloadZip('video-1', 'token', 'video.zip')).rejects.toBeInstanceOf(ApiError);
  });
});
