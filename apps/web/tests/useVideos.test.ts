import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  pollIntervalFor,
  totalPages,
  useVideos,
  FAST_POLL_MS,
  SLOW_POLL_MS,
} from '../src/features/videos/useVideos';
import { apiClient } from '../src/lib/api-client';

vi.mock('../src/features/auth/useAuth', () => {
  const session = { token: 'tok', logout: () => undefined };
  return { useAuth: () => session };
});

function visibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('pollIntervalFor', () => {
  it('polls fast while anything is pending or processing', () => {
    expect(pollIntervalFor([{ status: 'PROCESSING' }, { status: 'COMPLETED' }])).toBe(FAST_POLL_MS);
    expect(pollIntervalFor([{ status: 'PENDING' }])).toBe(FAST_POLL_MS);
  });

  it('backs off when everything reached a terminal state', () => {
    expect(pollIntervalFor([{ status: 'COMPLETED' }, { status: 'FAILED' }])).toBe(SLOW_POLL_MS);
  });

  it('backs off on an empty library', () => {
    expect(pollIntervalFor([])).toBe(SLOW_POLL_MS);
  });
});

describe('totalPages', () => {
  it('rounds up so a partial last page still counts', () => {
    expect(totalPages(21, 20)).toBe(2);
  });

  it('reports a single page for an empty library, never zero', () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it('reports exactly one page when the total fills it', () => {
    expect(totalPages(20, 20)).toBe(1);
  });
});

describe('useVideos polling', () => {
  let listVideos: MockInstance<typeof apiClient.listVideos>;

  beforeEach(() => {
    visibility('visible');
    listVideos = vi
      .spyOn(apiClient, 'listVideos')
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the library as soon as it mounts', async () => {
    renderHook(() => useVideos({}));

    await waitFor(() => expect(listVideos).toHaveBeenCalledTimes(1));
  });

  it('does not poll a hidden tab, and checks again shortly after', async () => {
    vi.useFakeTimers();
    visibility('hidden');
    renderHook(() => useVideos({}));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_POLL_MS);
    });

    expect(listVideos).not.toHaveBeenCalled();

    visibility('visible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FAST_POLL_MS);
    });

    expect(listVideos).toHaveBeenCalled();
  });

  it('reloads the moment the tab comes back to the foreground', async () => {
    visibility('hidden');
    renderHook(() => useVideos({}));

    visibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(listVideos).toHaveBeenCalledTimes(1));
  });

  it('ignores a visibility event that reports the tab still hidden', async () => {
    visibility('hidden');
    renderHook(() => useVideos({}));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(listVideos).not.toHaveBeenCalled();
  });

  it('stops polling once the caller unmounts', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useVideos({}));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(listVideos).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_POLL_MS * 2);
    });

    expect(listVideos).toHaveBeenCalledTimes(1);
  });

  it('surfaces the failure instead of a blank library', async () => {
    listVideos.mockRejectedValue(new Error('API fora do ar'));
    const { result } = renderHook(() => useVideos({}));

    await waitFor(() => expect(result.current.error).toBe('API fora do ar'));
    expect(result.current.isLoading).toBe(false);
  });
});
