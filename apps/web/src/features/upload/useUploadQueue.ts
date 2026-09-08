import { useCallback, useRef, useState } from 'react';
import { uploadWithProgress } from './uploadWithProgress';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../auth/useAuth';

export type UploadState = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  state: UploadState;
  /** The name the user typed for this file, if any. */
  title?: string;
  /** What the queue shows: the typed name, or the file name. */
  displayName: string;
  error?: string;
  videoId?: string;
}

/** Three at a time: enough to use the connection, few enough to keep bars honest. */
const MAX_PARALLEL = 3;

export interface UseUploadQueueResult {
  items: UploadItem[];
  enqueue: (files: File[], frameIntervalSeconds?: number) => void;
  rename: (itemId: string, title: string) => Promise<void>;
  cancel: (id: string) => void;
  clearFinished: () => void;
  activeCount: number;
}

export function useUploadQueue(): UseUploadQueueResult {
  const { token, logout } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(0);
  const pending = useRef<{ id: string; file: File; interval?: number }[]>([]);

  /**
   * Names typed before the server had an id for the file. The upload is already
   * in flight when the user starts typing, so the rename has to wait for the
   * response and then be sent — otherwise naming a large file would mean
   * watching a progress bar first.
   */
  const deferred = useRef(new Map<string, string>());

  /**
   * The list is mirrored in a ref because `rename` has to read an item — its id on
   * the server, whether it already failed — and act on it in the same tick. A
   * `setItems` updater cannot answer that: React runs it when it schedules the
   * render, not when it is called.
   */
  const itemsRef = useRef<UploadItem[]>([]);

  const commit = useCallback((next: UploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<UploadItem>) => {
      commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    },
    [commit],
  );

  const push = useCallback(
    async (videoId: string, title: string) => {
      if (!token) return;
      await apiClient.renameVideo(videoId, title || null, { token, onUnauthorized: logout });
    },
    [token, logout],
  );

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
        .then(async (video) => {
          patch(next.id, { state: 'done', progress: 100, videoId: video.id });

          const waiting = deferred.current.get(next.id);
          if (waiting !== undefined) {
            deferred.current.delete(next.id);
            await push(video.id, waiting).catch(() => {
              patch(next.id, { error: 'O vídeo subiu, mas o nome não foi salvo.' });
            });
          }
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Falha no envio.';
          deferred.current.delete(next.id);
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
  }, [token, patch, push]);

  const enqueue = useCallback(
    (files: File[], frameIntervalSeconds?: number) => {
      const created: UploadItem[] = files.map((file) => ({
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        progress: 0,
        state: 'queued',
        displayName: file.name,
      }));

      commit([...created, ...itemsRef.current]);
      pending.current.push(
        ...created.map((item) => ({
          id: item.id,
          file: item.file,
          interval: frameIntervalSeconds,
        })),
      );
      pump();
    },
    [pump, commit],
  );

  const rename = useCallback(
    async (itemId: string, title: string) => {
      const trimmed = title.trim();
      const target = itemsRef.current.find((item) => item.id === itemId);
      if (!target) return;

      patch(itemId, {
        title: trimmed || undefined,
        displayName: trimmed || target.file.name,
      });

      if (target.state === 'error' || target.state === 'cancelled') return;

      if (target.videoId) {
        await push(target.videoId, trimmed);
        return;
      }

      deferred.current.set(itemId, trimmed);
    },
    [push, patch],
  );

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    pending.current = pending.current.filter((entry) => entry.id !== id);
    deferred.current.delete(id);
  }, []);

  const clearFinished = useCallback(() => {
    commit(itemsRef.current.filter((item) => item.state !== 'done'));
  }, [commit]);

  return {
    items,
    enqueue,
    rename,
    cancel,
    clearFinished,
    activeCount: items.filter((item) => item.state === 'uploading' || item.state === 'queued')
      .length,
  };
}
