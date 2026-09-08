import { API_BASE, ApiError } from '../../lib/api-client';
import type { VideoSummary } from '../../lib/types';

export interface UploadOptions {
  file: File;
  token: string;
  frameIntervalSeconds?: number;
  title?: string;
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Uploads one file and reports real progress.
 *
 * `fetch` still cannot report upload progress in any browser, so this uses
 * XMLHttpRequest — the alternative would be a fake animated bar, which lies to
 * the user about a 500 MB transfer.
 */
export function uploadWithProgress(options: UploadOptions): Promise<VideoSummary> {
  return new Promise<VideoSummary>((resolve, reject) => {
    const form = new FormData();
    // Both fields go in before the file: busboy hands the server its fields in
    // wire order, and the use case needs them when the file part arrives.
    if (options.frameIntervalSeconds !== undefined) {
      form.append('frameIntervalSeconds', String(options.frameIntervalSeconds));
    }
    if (options.title) form.append('title', options.title);
    form.append('file', options.file, options.file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/videos`);
    xhr.setRequestHeader('Authorization', `Bearer ${options.token}`);

    xhr.upload.onprogress = (event: ProgressEvent): void => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = (): void => {
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as VideoSummary);
        return;
      }

      const error = (parsed as { error?: { message?: string; code?: string } } | null)?.error;
      reject(new ApiError(error?.message ?? `Falha no envio (${xhr.status})`, xhr.status));
    };

    xhr.onerror = (): void => reject(new ApiError('Falha de rede durante o envio.', 0));
    xhr.onabort = (): void => reject(new ApiError('Envio cancelado.', 0));

    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    if (options.signal?.aborted) {
      xhr.abort();
      return;
    }

    xhr.send(form);
  });
}
