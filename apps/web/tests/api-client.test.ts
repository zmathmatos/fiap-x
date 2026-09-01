import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError } from '../src/lib/api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient', () => {
  it('sends the bearer token on authenticated calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0, page: 1, limit: 20 }));

    await apiClient.listVideos({ token: 't0k3n' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k3n');
  });

  it('builds the query string from the given filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0, page: 1, limit: 20 }));

    await apiClient.listVideos({ token: 't', status: 'FAILED', search: 'ferias', page: 2 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/videos?status=FAILED&search=ferias&page=2');
  });

  it('surfaces the server error message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'E-mail já cadastrado.', code: 'VALIDATION_ERROR' } }, 400),
    );

    await expect(
      apiClient.register({ name: 'A', email: 'a@b.c', password: '12345678' }),
    ).rejects.toThrow('E-mail já cadastrado.');
  });

  it('exposes the status code on the error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Vídeo not found' } }, 404));

    const error = await apiClient.getVideo('v1', { token: 't' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('notifies the caller on 401 so the session can be dropped', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Unauthorized' } }, 401));
    const onUnauthorized = vi.fn();

    await expect(apiClient.listVideos({ token: 'x', onUnauthorized })).rejects.toThrow();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not set a content-type on requests without a body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'u1' }));

    await apiClient.me({ token: 't' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
