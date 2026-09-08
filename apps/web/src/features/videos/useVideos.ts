import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../auth/useAuth';
import type { VideoSummary } from '../../lib/types';

export const FAST_POLL_MS = 2000;
export const SLOW_POLL_MS = 15000;

/**
 * Polls quickly only while something can still change.
 *
 * A library full of finished videos does not need a request every two seconds;
 * one with a video in the queue does.
 */
export function pollIntervalFor(videos: Pick<VideoSummary, 'status'>[]): number {
  const busy = videos.some((video) => video.status === 'PENDING' || video.status === 'PROCESSING');
  return busy ? FAST_POLL_MS : SLOW_POLL_MS;
}

export const PAGE_SIZE = 20;

/** Never zero: an empty library still shows "1 de 1" rather than "1 de 0". */
export function totalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

export interface UseVideosFilters {
  status?: string;
  search?: string;
  page?: number;
}

export interface UseVideosResult {
  videos: VideoSummary[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useVideos(filters: UseVideosFilters): UseVideosResult {
  const { token, logout } = useAuth();
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, search, page = 1 } = filters;

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const result = await apiClient.listVideos({
        token,
        onUnauthorized: logout,
        status,
        search,
        page,
        limit: PAGE_SIZE,
      });
      setVideos(result.items);
      setTotal(result.total);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os vídeos.');
    } finally {
      setIsLoading(false);
    }
  }, [token, logout, status, search, page]);

  useEffect(() => {
    let active = true;

    const tick = async (): Promise<void> => {
      if (!active) return;

      // A hidden tab does not need updates; check again shortly after it returns.
      if (document.visibilityState === 'hidden') {
        timer.current = setTimeout(() => void tick(), FAST_POLL_MS);
        return;
      }

      await load();
      if (!active) return;

      setVideos((current) => {
        timer.current = setTimeout(() => void tick(), pollIntervalFor(current));
        return current;
      });
    };

    void tick();

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { videos, total, isLoading, error, refresh: () => void load() };
}
