import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, API_BASE } from '../src/lib/api-client';

let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(json({}));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiClient auth endpoints', () => {
  it('posts a registration', async () => {
    await apiClient.register({ name: 'Ana', email: 'ana@fiapx.local', password: 'senha-secreta' });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE}/auth/register`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ email: 'ana@fiapx.local' });
  });

  it('posts a login', async () => {
    await apiClient.login({ email: 'ana@fiapx.local', password: 'senha-secreta' });

    expect(lastCall()[0]).toBe(`${API_BASE}/auth/login`);
  });

  it('reads the session user with the bearer token', async () => {
    await apiClient.me({ token: 'token-abc' });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE}/me`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
  });
});

describe('apiClient video endpoints', () => {
  it('asks for the plain list when there is no filter', async () => {
    await apiClient.listVideos({ token: 'token-abc' });

    expect(lastCall()[0]).toBe(`${API_BASE}/videos`);
  });

  it('turns the filters into a query string', async () => {
    await apiClient.listVideos({
      token: 'token-abc',
      status: 'FAILED',
      search: 'aula',
      page: 2,
      limit: 20,
    });

    const url = lastCall()[0];
    expect(url).toContain('status=FAILED');
    expect(url).toContain('search=aula');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
  });

  it('leaves empty filters out of the query', async () => {
    await apiClient.listVideos({ token: 'token-abc', status: '', search: '' });

    expect(lastCall()[0]).toBe(`${API_BASE}/videos`);
  });

  it('reads one video', async () => {
    await apiClient.getVideo('v1', { token: 'token-abc' });

    expect(lastCall()[0]).toBe(`${API_BASE}/videos/v1`);
  });

  it('patches the title', async () => {
    await apiClient.renameVideo('v1', 'Aula 1', { token: 'token-abc' });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE}/videos/v1`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Aula 1' });
  });

  it('clears the title with an explicit null', async () => {
    await apiClient.renameVideo('v1', null, { token: 'token-abc' });

    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ title: null });
  });

  it('builds the download url', () => {
    expect(apiClient.downloadUrl('v1')).toBe(`${API_BASE}/videos/v1/download`);
  });
});

describe('apiClient.fetchThumbnail', () => {
  it('returns a blob url for the poster', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:poster');
    fetchMock.mockResolvedValue(new Response(new Blob(['jpeg']), { status: 200 }));

    await expect(apiClient.fetchThumbnail('/videos/v1/thumb', { token: 'token-abc' })).resolves.toBe(
      'blob:poster',
    );
  });

  it('carries the token and the abort signal', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:poster');
    fetchMock.mockResolvedValue(new Response(new Blob(['jpeg']), { status: 200 }));
    const controller = new AbortController();

    await apiClient.fetchThumbnail('/videos/v1/thumb', {
      token: 'token-abc',
      signal: controller.signal,
    });

    const [, init] = lastCall();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
    expect(init.signal).toBe(controller.signal);
  });

  it('reports a missing poster as an ApiError instead of a broken image', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    await expect(
      apiClient.fetchThumbnail('/videos/v1/thumb', { token: 'token-abc' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('tells the app the session died on a 401', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    const onUnauthorized = vi.fn();

    await expect(
      apiClient.fetchThumbnail('/videos/v1/thumb', { token: 'expired', onUnauthorized }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
