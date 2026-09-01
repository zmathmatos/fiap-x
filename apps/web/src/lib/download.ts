import { ApiError, API_BASE } from './api-client';

function filenameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);

  const plain = /filename="([^"]+)"/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

/**
 * Downloads the zip through an authenticated request.
 *
 * A plain `<a download>` cannot carry the bearer token, and putting the token in
 * the query string would leak it into browser history and access logs. So the
 * file is fetched, turned into a blob, and handed to a synthetic link.
 */
export async function downloadZip(
  videoId: string,
  token: string,
  suggestedName: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${videoId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const raw = await response.text();
    const message = raw
      ? ((JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? null)
      : null;
    throw new ApiError(message ?? 'Não foi possível baixar o arquivo.', response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(response.headers.get('content-disposition'), suggestedName);
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
