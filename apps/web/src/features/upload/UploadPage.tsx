import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Dropzone } from './Dropzone';
import { useUploadQueue, type UploadItem } from './useUploadQueue';
import { formatBytes } from '../../lib/format';

const INTERVAL_OPTIONS = [1, 5, 10, 20, 60];

const STATE_LABELS: Record<UploadItem['state'], string> = {
  queued: 'Na fila',
  uploading: 'Enviando',
  done: 'Enviado',
  error: 'Falhou',
  cancelled: 'Cancelado',
};

export function UploadPage(): JSX.Element {
  const [interval, setIntervalSeconds] = useState(20);
  const { items, enqueue, cancel, clearFinished, activeCount } = useUploadQueue();

  const finishedCount = items.filter((item) => item.state === 'done').length;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Enviar vídeo</h1>
          <p className="page-header__subtitle">
            Os arquivos entram na fila assim que o envio termina. Você pode fechar esta página
            depois disso.
          </p>
        </div>
        <Link className="button" to="/">
          Ver biblioteca
        </Link>
      </header>

      <div className="toolbar">
        <label className="field__label" htmlFor="interval">
          Extrair 1 frame a cada
        </label>
        <select
          id="interval"
          className="field__select"
          value={interval}
          onChange={(event) => setIntervalSeconds(Number(event.target.value))}
        >
          {INTERVAL_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} {seconds === 1 ? 'segundo' : 'segundos'}
            </option>
          ))}
        </select>
        <span className="toolbar__spacer" />
        {activeCount > 0 && (
          <span className="toolbar__meta">
            {activeCount} {activeCount === 1 ? 'envio em andamento' : 'envios em andamento'}
          </span>
        )}
      </div>

      <Dropzone onFiles={(files) => enqueue(files, interval)} />

      {items.length > 0 && (
        <>
          <div className="toolbar" style={{ marginTop: 'var(--space-6)' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Envios desta sessão
            </h2>
            <span className="toolbar__spacer" />
            {finishedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFinished}>
                Limpar concluídos
              </Button>
            )}
          </div>

          <div className="panel queue">
            {items.map((item) => (
              <div className="queue__item" key={item.id}>
                <span className="queue__name" title={item.file.name}>
                  {item.file.name}
                </span>
                <span className="queue__meta">
                  {formatBytes(item.file.size)} · {STATE_LABELS[item.state]}
                  {item.state === 'uploading' ? ` ${item.progress}%` : ''}
                  {item.state === 'uploading' && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={() => cancel(item.id)}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {item.state === 'done' && item.videoId && (
                    <>
                      {' · '}
                      <Link to={`/videos/${item.videoId}`}>Acompanhar</Link>
                    </>
                  )}
                </span>

                <div
                  className="queue__bar"
                  role="progressbar"
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progresso de ${item.file.name}`}
                >
                  <span style={{ width: `${item.progress}%` }} />
                </div>

                {item.error && item.state === 'error' && (
                  <p className="queue__error" role="alert">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
