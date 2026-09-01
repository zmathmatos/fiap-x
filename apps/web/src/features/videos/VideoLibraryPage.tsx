import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { VideoTable } from './VideoTable';
import { useVideos } from './useVideos';
import type { VideoStatus } from '../../lib/types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Na fila' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'COMPLETED', label: 'Concluídos' },
  { value: 'FAILED', label: 'Com falha' },
];

function TableSkeleton(): JSX.Element {
  return (
    <div style={{ padding: 'var(--space-4)' }} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton" style={{ marginBottom: 'var(--space-4)' }} />
      ))}
    </div>
  );
}

export function VideoLibraryPage(): JSX.Element {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({ status: status || undefined, search: search.trim() || undefined }),
    [status, search],
  );
  const { videos, total, isLoading, error } = useVideos(filters);

  const busyCount = videos.filter(
    (video) => video.status === ('PENDING' as VideoStatus) || video.status === 'PROCESSING',
  ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Biblioteca</h1>
          <p className="page-header__subtitle">
            {busyCount > 0
              ? `${busyCount} ${busyCount === 1 ? 'vídeo em andamento' : 'vídeos em andamento'} · atualizando automaticamente`
              : 'Todos os vídeos enviados por você.'}
          </p>
        </div>
        <Link className="button button--primary" to="/upload">
          Enviar vídeo
        </Link>
      </header>

      <div className="toolbar">
        <div className="search">
          <input
            className="field__input"
            type="search"
            placeholder="Buscar por nome do arquivo"
            aria-label="Buscar por nome do arquivo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="field__select"
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
        <span className="toolbar__spacer" />
        {!isLoading && (
          <span className="toolbar__meta">
            {total} {total === 1 ? 'vídeo' : 'vídeos'}
          </span>
        )}
      </div>

      {error && (
        <p className="alert" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
      )}

      <div className="panel">
        {isLoading ? (
          <TableSkeleton />
        ) : videos.length === 0 ? (
          filters.status || filters.search ? (
            <EmptyState
              title="Nenhum vídeo com esse filtro"
              body="Ajuste a busca ou o status para ver outros resultados."
            />
          ) : (
            <EmptyState
              title="Nenhum vídeo por aqui ainda"
              body="Envie um arquivo e ele entra na fila de processamento. Você recebe um .zip com os frames assim que terminar."
              action={
                <Link className="button button--primary" to="/upload">
                  Enviar vídeo
                </Link>
              }
            />
          )
        ) : (
          <VideoTable videos={videos} />
        )}
      </div>
    </>
  );
}
