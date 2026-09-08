import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { apiClient } from '../../lib/api-client';
import { DURATION } from '../../lib/motion';
import { useAuth } from '../auth/useAuth';

interface ThumbnailProps {
  /** API path from the video payload, or null while there is no poster yet. */
  path: string | null;
  frameCount: number | null;
  className?: string;
}

/**
 * The first frame the worker pulled out of the video.
 *
 * It exists to make the product's one job obvious at a glance: the library stops
 * being a list of file names and becomes a wall of frames that were extracted.
 *
 * The image is fetched rather than pointed at, because the endpoint is behind the
 * same bearer token as the rest of the API and `<img src>` sends no headers. The
 * blob URL is revoked on unmount so a long session does not leak one per row.
 */
export function Thumbnail({ path, frameCount, className = '' }: ThumbnailProps): JSX.Element {
  const { token, logout } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path || !token) return;

    let revoked = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    apiClient
      .fetchThumbnail(path, { token, onUnauthorized: logout, signal: controller.signal })
      .then((created) => {
        objectUrl = created;
        if (revoked) {
          URL.revokeObjectURL(created);
          return;
        }
        setUrl(created);
      })
      .catch(() => {
        // A missing poster is not worth an error message; the placeholder stands in.
      });

    return () => {
      revoked = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, token, logout]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-surface-container-high ${className}`}
    >
      {url ? (
        <motion.img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.base, ease: 'easeOut' }}
        />
      ) : (
        <span
          className="absolute inset-0 grid place-items-center text-secondary"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[18px]">movie</span>
        </span>
      )}

      {url && frameCount !== null && frameCount > 0 && (
        <span className="absolute bottom-0 inset-x-0 bg-inverse-surface/70 text-inverse-on-surface text-[10px] leading-none py-0.5 text-center tabular-nums">
          {frameCount} frames
        </span>
      )}
    </div>
  );
}
