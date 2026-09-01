import { useCallback, useRef, useState } from 'react';
import { uploadWithProgress } from './uploadWithProgress';
import { useAuth } from '../auth/useAuth';

export type UploadState = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  state: UploadState;
  error?: string;
  videoId?: string;
}

/** Three at a time: enough to use the connection, few enough to keep bars honest. */
const MAX_PARALLEL = 3;

export interface UseUploadQueueResult {
  items: UploadItem[];
  enqueue: (files: File[], frameIntervalSeconds?: number) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
  activeCount: number;
}

export function useUploadQueue(): UseUploadQueueResult {
  const { token } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(0);
  const pending = useRef<{ id: string; file: File; interval?: number }[]>([]);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const pump = useCallback(() => {
    if (!token) return;

    while (running.current < MAX_PARALLEL && pending.current.length > 0) {
      const next = pending.current.shift();
      if (!next) break;

      const controller = new AbortController();
      controllers.current.set(next.id, controller);
      running.current += 1;
      patch(next.id, { state: 'uploading' });

      uploadWithProgress({
        file: next.file,
        token,
        frameIntervalSeconds: next.interval,
        signal: controller.signal,
        onProgress: (percent) => patch(next.id, { progress: percent }),
      })
        .then((video) => patch(next.id, { state: 'done', progress: 100, videoId: video.id }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Falha no envio.';
          patch(next.id, {
            state: message === 'Envio cancelado.' ? 'cancelled' : 'error',
            error: message,
          });
        })
        .finally(() => {
          controllers.current.delete(next.id);
          running.current -= 1;
          pump();
        });
    }
  }, [token, patch]);

  const enqueue = useCallback(
    (files: File[], frameIntervalSeconds?: number) => {
      const created: UploadItem[] = files.map((file) => ({
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        progress: 0,
        state: 'queued',
      }));

      setItems((current) => [...created, ...current]);
      pending.current.push(
        ...created.map((item) => ({
          id: item.id,
          file: item.file,
          interval: frameIntervalSeconds,
        })),
      );
      pump();
    },
    [pump],
  );

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    pending.current = pending.current.filter((entry) => entry.id !== id);
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => item.state !== 'done'));
  }, []);

  return {
    items,
    enqueue,
    cancel,
    clearFinished,
    activeCount: items.filter((item) => item.state === 'uploading' || item.state === 'queued')
      .length,
  };
}
