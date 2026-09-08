import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { EmptyState } from '../../components/EmptyState';
import { NumberTicker } from '../../components/NumberTicker';
import { VideoTable } from './VideoTable';
import { PAGE_SIZE, totalPages, useVideos } from './useVideos';
import { DURATION, SPRING, staggerDelay } from '../../lib/motion';
import { formatCount } from '../../lib/format';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../auth/useAuth';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Na fila' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'COMPLETED', label: 'Concluídos' },
  { value: 'FAILED', label: 'Com falha' },
];

function TableSkeleton(): JSX.Element {
  return (
    <div className="p-md flex flex-col gap-md" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="relative h-6 rounded-lg bg-surface-container-high overflow-hidden"
          style={{ animationDelay: `${staggerDelay(index)}s` }}
        >
          <span className="absolute inset-0 -translate-x-full animate-shimmer motion-reduce:animate-none bg-gradient-to-r from-transparent via-surface-container-lowest/80 to-transparent" />
        </div>
      ))}
    </div>
  );
}

export function VideoLibraryPage(): JSX.Element {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // A narrower filter can leave the current page past the end of the results.
  useEffect(() => setPage(1), [status, search]);

  const filters = useMemo(
    () => ({ status: status || undefined, search: search.trim() || undefined, page }),
    [status, search, page],
  );
  const { videos, total, isLoading, error, refresh } = useVideos(filters);
  const { token, logout } = useAuth();

  const rename = useCallback(
    async (videoId: string, title: string) => {
      if (!token) return;
      await apiClient.renameVideo(videoId, title || null, { token, onUnauthorized: logout });
      refresh();
    },
    [token, logout, refresh],
  );

  const busyCount = videos.filter(
    (video) => video.status === 'PENDING' || video.status === 'PROCESSING',
  ).length;
  const lastPage = totalPages(total, PAGE_SIZE);
  const filtered = Boolean(filters.status || filters.search);

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-md">
        <div>
          <h1 className="text-headline-md text-on-surface">Biblioteca</h1>
          <div className="flex items-center gap-sm mt-xs min-h-[18px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={busyCount > 0 ? 'busy' : 'idle'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: DURATION.fast }}
                className="flex items-center gap-sm text-body-sm text-on-surface-variant"
              >
                {busyCount > 0 && (
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-circle bg-tertiary-container animate-ping-slow motion-reduce:animate-none" />
                    <span className="relative w-2 h-2 rounded-circle bg-tertiary-container" />
                  </span>
                )}
                {busyCount > 0
                  ? `${busyCount} ${busyCount === 1 ? 'vídeo em andamento' : 'vídeos em andamento'} · atualizando automaticamente`
                  : 'Todos os vídeos enviados por você.'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={SPRING.snappy}
        >
          <Link
            to="/upload"
            className="inline-flex items-center gap-sm bg-primary text-on-primary text-body-sm font-semibold px-lg h-10 rounded-full hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              upload_file
            </span>
            Enviar vídeo
          </Link>
        </motion.div>
      </header>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm panel p-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-sm">
          <div className="relative sm:w-[240px]">
            <span
              className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-[18px] text-secondary pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              className="field-input pl-xl"
              type="search"
              placeholder="Buscar por nome"
              aria-label="Buscar por nome do vídeo ou do arquivo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="field-input sm:w-auto"
            aria-label="Filtrar por status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {!isLoading && (
          <span className="text-body-sm text-secondary tabular-nums sm:pr-sm">
            <NumberTicker value={total} format={formatCount} durationSeconds={0.5} />{' '}
            {total === 1 ? 'vídeo' : 'vídeos'}
          </span>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-md py-sm rounded-xl bg-error-container text-on-error-container text-body-sm overflow-hidden"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="panel overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : videos.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Nenhum vídeo com esse filtro"
              body="Ajuste a busca ou o status para ver outros resultados."
            />
          ) : (
            <EmptyState
              title="Nenhum vídeo por aqui ainda"
              body="Envie um arquivo e ele entra na fila de processamento. Você recebe um .zip com os frames assim que terminar."
              action={
                <Link
                  to="/upload"
                  className="inline-flex items-center bg-primary text-on-primary text-body-sm font-semibold px-lg h-10 rounded-full hover:bg-primary-container transition-colors"
                >
                  Enviar vídeo
                </Link>
              }
            />
          )
        ) : (
          <>
            <VideoTable videos={videos} onRename={rename} />
            {lastPage > 1 && (
              <nav
                className="px-md py-sm border-t border-secondary-container flex justify-between items-center"
                aria-label="Paginação"
              >
                <span className="text-body-sm text-secondary tabular-nums">
                  Página {page} de {lastPage}
                </span>
                <div className="flex gap-xs">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-secondary-container text-secondary hover:bg-surface-container-low disabled:opacity-40"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      chevron_left
                    </span>
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-secondary-container text-secondary hover:bg-surface-container-low disabled:opacity-40"
                    onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                    disabled={page >= lastPage}
                    aria-label="Próxima página"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      chevron_right
                    </span>
                  </motion.button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
