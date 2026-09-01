import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusPill } from '../../components/StatusPill';
import { EventTimeline } from './EventTimeline';
import { DownloadButton } from './DownloadButton';
import { apiClient } from '../../lib/api-client';
import { formatBytes, formatCount, formatDateTime, formatDuration } from '../../lib/format';
import { useAuth } from '../auth/useAuth';
import { FAST_POLL_MS } from './useVideos';
import type { VideoDetail } from '../../lib/types';

export function VideoDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const { token, logout } = useAuth();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      setVideo(await apiClient.getVideo(id, { token, onUnauthorized: logout }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o vídeo.');
    } finally {
      setIsLoading(false);
    }
  }, [id, token, logout]);

  useEffect(() => {
    let active = true;

    const tick = async (): Promise<void> => {
      await load();
      if (!active) return;

      setVideo((current) => {
        // Stop polling once the video reaches a state that cannot change again.
        if (current && (current.status === 'PENDING' || current.status === 'PROCESSING')) {
          timer.current = setTimeout(() => void tick(), FAST_POLL_MS);
        }
        return current;
      });
    };

    void tick();

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  if (isLoading) {
    return (
      <div aria-live="polite">
        <div className="skeleton" style={{ width: '240px', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ width: '100%', height: '72px' }} />
      </div>
    );
  }

  if (error || !video) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-header__title">Vídeo</h1>
        </header>
        <p className="alert" role="alert">
          {error ?? 'Vídeo não encontrado.'}
        </p>
        <p style={{ marginTop: 'var(--space-4)' }}>
          <Link className="button" to="/">
            Voltar para a biblioteca
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-header__subtitle">
            <Link to="/">Biblioteca</Link>
          </p>
          <h1 className="page-header__title">{video.originalName}</h1>
          <p className="page-header__subtitle">
            Enviado em {formatDateTime(video.createdAt)} · 1 frame a cada{' '}
            {video.frameIntervalSeconds}s
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <StatusPill status={video.status} />
          {video.downloadable && (
            <DownloadButton
              videoId={video.id}
              originalName={video.originalName}
              variant="primary"
              size="md"
            />
          )}
        </div>
      </header>

      {video.status === 'FAILED' && video.errorReason && (
        <p className="alert" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          {video.errorReason}
        </p>
      )}

      <div className="detail-grid">
        <div className="stat">
          <p className="stat__label">Duração</p>
          <p className="stat__value">{formatDuration(video.durationMs)}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Frames</p>
          <p className="stat__value">{formatCount(video.frameCount)}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Tamanho do zip</p>
          <p className="stat__value">{formatBytes(video.sizeBytes)}</p>
        </div>
        <div className="stat">
          <p className="stat__label">Intervalo</p>
          <p className="stat__value">{video.frameIntervalSeconds}s</p>
        </div>
      </div>

      <h2 className="section-title">Linha do tempo</h2>
      <EventTimeline events={video.events} />
    </>
  );
}
