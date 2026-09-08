import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { StatusPill } from '../../components/StatusPill';
import { NumberTicker } from '../../components/NumberTicker';
import { EventTimeline } from './EventTimeline';
import { DownloadButton } from './DownloadButton';
import { ProgressBar } from './ProgressBar';
import { Thumbnail } from './Thumbnail';
import { RenameField } from './RenameField';
import { apiClient } from '../../lib/api-client';
import {
  formatBitrate,
  formatBytes,
  formatCount,
  formatDateTime,
  formatDuration,
  formatFrameRate,
  formatResolution,
} from '../../lib/format';
import { DURATION, SPRING, staggerDelay } from '../../lib/motion';
import { useAuth } from '../auth/useAuth';
import { FAST_POLL_MS } from './useVideos';
import type { VideoDetail } from '../../lib/types';

interface MetricProps {
  label: string;
  value: number | null;
  format: (value: number | null) => string;
  index: number;
}

/**
 * The four figures the screen exists to show. They count up rather than appear:
 * the animation is short, it happens once per visit, and it puts the reader's
 * eye on the numbers instead of on the chrome around them.
 */
function Metric({ label, value, format, index }: MetricProps): JSX.Element {
  return (
    <motion.div
      className="panel p-md flex flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerDelay(index), duration: DURATION.base }}
    >
      <span className="text-label-caps uppercase text-secondary">{label}</span>
      <span className="text-body-lg text-on-surface mt-xs">
        <NumberTicker value={value} format={format} />
      </span>
    </motion.div>
  );
}

function TechnicalRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between items-center gap-md">
      <span className="text-body-sm text-secondary">{label}</span>
      <span className="text-body-sm text-on-surface tabular-nums">{value}</span>
    </div>
  );
}

export function VideoDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const { token, logout } = useAuth();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rename = useCallback(
    async (title: string) => {
      if (!token) return;
      const updated = await apiClient.renameVideo(id, title || null, {
        token,
        onUnauthorized: logout,
      });
      setVideo((current) =>
        current === null ? current : { ...current, ...updated, events: current.events },
      );
    },
    [id, token, logout],
  );

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
      <div aria-live="polite" className="flex flex-col gap-md">
        {[240, 0, 0].map((width, index) => (
          <div
            key={index}
            className="relative rounded-xl bg-surface-container-high overflow-hidden"
            style={{ width: width ? `${width}px` : '100%', height: index === 0 ? 32 : 72 }}
          >
            <span className="absolute inset-0 -translate-x-full animate-shimmer motion-reduce:animate-none bg-gradient-to-r from-transparent via-surface-container-lowest/80 to-transparent" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !video) {
    return (
      <>
        <h1 className="text-headline-md text-on-surface">Vídeo</h1>
        <p
          className="px-md py-sm rounded-xl bg-error-container text-on-error-container text-body-sm"
          role="alert"
        >
          {error ?? 'Vídeo não encontrado.'}
        </p>
        <Link
          to="/"
          className="self-start inline-flex items-center px-lg h-10 rounded-full border border-secondary-container text-body-sm text-on-surface hover:bg-surface-container-low transition-colors"
        >
          Voltar para a biblioteca
        </Link>
      </>
    );
  }

  const hasTechnical =
    video.codec !== null ||
    video.width !== null ||
    video.frameRate !== null ||
    video.bitrateBps !== null;

  return (
    <>
      <nav
        className="flex items-center gap-xs text-body-sm text-secondary min-w-0"
        aria-label="Trilha"
      >
        <Link to="/" className="shrink-0 hover:text-on-surface transition-colors">
          Biblioteca
        </Link>
        <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">
          chevron_right
        </span>
        <span className="text-on-surface truncate min-w-0" title={video.displayName}>
          {video.displayName}
        </span>
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-start gap-md">
        {/*
          `min-w-0` on the growing side is what actually contains a long file name:
          without it a flex child sizes to its content and pushes the download
          button off the row instead of truncating.
        */}
        <div className="flex items-start gap-md min-w-0 flex-1">
          <Thumbnail
            path={video.thumbnailUrl}
            frameCount={null}
            className="hidden sm:block w-28 h-[70px]"
          />
          <div className="flex flex-col gap-xs min-w-0 flex-1">
            <div className="flex items-center gap-sm min-w-0">
              {/*
                Names here are file names, which routinely run to eighty characters
                with no spaces to break on. One line, truncated, full text in the
                tooltip — a wrapped one would push the whole page down.
              */}
              <h1 className="text-headline-sm sm:text-headline-md text-on-surface min-w-0 flex-1">
                <RenameField value={video.displayName} onSave={rename} />
              </h1>
              <span className="shrink-0">
                <StatusPill status={video.status} />
              </span>
            </div>
            <p className="text-body-sm text-secondary truncate" title={video.originalName}>
              {video.title ? `${video.originalName} · ` : ''}
              Enviado em {formatDateTime(video.createdAt)} · 1 frame a cada{' '}
              {video.frameIntervalSeconds}s
            </p>
          </div>
        </div>
        {video.downloadable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING.snappy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="shrink-0"
          >
            <DownloadButton
              videoId={video.id}
              originalName={video.originalName}
              variant="primary"
              size="md"
            />
          </motion.div>
        )}
      </header>

      {video.status === 'PROCESSING' && (
        <div className="panel p-md flex flex-col gap-sm">
          <span className="text-label-caps uppercase text-secondary">Extraindo frames</span>
          <ProgressBar percent={video.progressPercent} />
        </div>
      )}

      {video.status === 'FAILED' && video.errorReason && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-md py-sm rounded-xl bg-error-container text-on-error-container text-body-sm"
          role="alert"
        >
          {video.errorReason}
        </motion.p>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        <Metric label="Duração" value={video.durationMs} format={formatDuration} index={0} />
        <Metric label="Frames" value={video.frameCount} format={formatCount} index={1} />
        <Metric label="Zip" value={video.sizeBytes} format={formatBytes} index={2} />
        <Metric
          label="Intervalo"
          value={video.frameIntervalSeconds}
          format={(seconds) => (seconds === null ? '—' : `${Math.round(seconds)}s`)}
          index={3}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        <section className="lg:col-span-8 flex flex-col gap-md">
          <h2 className="text-body-lg font-bold text-on-surface">Linha do tempo</h2>
          <EventTimeline events={video.events} />
        </section>

        {hasTechnical && (
          <motion.aside
            className="lg:col-span-4 panel p-md flex flex-col gap-sm"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: DURATION.slow, ease: 'easeOut' }}
          >
            <h2 className="text-body-sm font-semibold text-on-surface border-b border-secondary-container pb-xs">
              Informações técnicas
            </h2>
            <TechnicalRow label="Codec" value={video.codec ?? '—'} />
            <TechnicalRow label="Resolução" value={formatResolution(video.width, video.height)} />
            <TechnicalRow label="Taxa de quadros" value={formatFrameRate(video.frameRate)} />
            <TechnicalRow label="Taxa de bits" value={formatBitrate(video.bitrateBps)} />
          </motion.aside>
        )}
      </div>
    </>
  );
}
