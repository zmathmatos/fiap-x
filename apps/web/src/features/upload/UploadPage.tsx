import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/Button';
import { Dropzone } from './Dropzone';
import { UploadCheck } from './UploadCheck';
import { useUploadQueue, type UploadItem } from './useUploadQueue';
import { RenameField } from '../videos/RenameField';
import { formatBytes } from '../../lib/format';
import { DURATION, SPRING } from '../../lib/motion';

const INTERVAL_OPTIONS = [1, 5, 10, 20, 60];

const STATE_LABELS: Record<UploadItem['state'], string> = {
  queued: 'Na fila',
  uploading: 'Enviando',
  done: 'Enviado',
  error: 'Falhou',
  cancelled: 'Cancelado',
};

const BAR_COLOR: Record<UploadItem['state'], string> = {
  queued: 'bg-secondary',
  uploading: 'bg-primary',
  done: 'bg-success',
  error: 'bg-error',
  cancelled: 'bg-secondary',
};

export function UploadPage(): JSX.Element {
  const [interval, setIntervalSeconds] = useState(20);
  const { items, enqueue, rename, cancel, clearFinished, activeCount } = useUploadQueue();

  const finishedCount = items.filter((item) => item.state === 'done').length;

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-md">
        <div>
          <h1 className="text-headline-md text-on-surface">Enviar vídeo</h1>
          <p className="text-body-sm text-secondary mt-xs">
            Os arquivos entram na fila assim que o envio termina. Você pode fechar esta página
            depois disso.
          </p>
        </div>
        <Link
          to="/"
          className="shrink-0 inline-flex items-center px-lg h-10 rounded-full border border-secondary-container bg-surface-container-lowest text-body-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
        >
          Ver biblioteca
        </Link>
      </header>

      <div className="panel p-md flex flex-col sm:flex-row sm:items-end gap-md">
        <div className="flex-1 flex flex-col gap-xs">
          <label className="text-body-sm text-on-secondary-container" htmlFor="interval">
            Extrair 1 frame a cada
          </label>
          <select
            id="interval"
            className="field-input"
            value={interval}
            onChange={(event) => setIntervalSeconds(Number(event.target.value))}
          >
            {INTERVAL_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} {seconds === 1 ? 'segundo' : 'segundos'}
              </option>
            ))}
          </select>
          <span className="text-body-sm text-secondary">
            Um vídeo de 10 minutos rende{' '}
            <strong className="text-on-surface tabular-nums">
              {Math.floor(600 / interval)} frames
            </strong>{' '}
            nesse intervalo.
          </span>
        </div>

        <AnimatePresence>
          {activeCount > 0 && (
            <motion.span
              className="text-body-sm text-secondary sm:pb-sm"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              {activeCount} {activeCount === 1 ? 'envio em andamento' : 'envios em andamento'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <Dropzone onFiles={(files) => enqueue(files, interval)} />

      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            className="panel overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.base }}
          >
            <div className="px-md py-sm border-b border-secondary-container bg-surface-container-low flex justify-between items-center">
              <h2 className="text-label-caps uppercase text-secondary">
                Fila de upload ({items.length}) · clique no lápis para dar um nome
              </h2>
              {finishedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFinished}>
                  Limpar concluídos
                </Button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: 'easeOut' }}
                  className="border-b border-secondary-container last:border-b-0 overflow-hidden"
                >
                  <div className="p-md flex flex-col gap-sm">
                    <div className="flex justify-between items-center gap-md">
                      <span className="flex items-center gap-sm min-w-0 text-body-sm font-semibold text-on-surface">
                        {item.state === 'done' && <UploadCheck />}
                        <RenameField
                          value={item.displayName}
                          onSave={(next) => rename(item.id, next)}
                          className="min-w-0"
                        />
                      </span>

                      {item.state === 'uploading' && (
                        <button
                          type="button"
                          className="text-body-sm text-primary hover:underline shrink-0"
                          onClick={() => cancel(item.id)}
                        >
                          Cancelar
                        </button>
                      )}
                      {item.state === 'done' && item.videoId && (
                        <Link
                          to={`/videos/${item.videoId}`}
                          className="text-body-sm text-tertiary hover:underline shrink-0"
                        >
                          Acompanhar
                        </Link>
                      )}
                    </div>

                    <span className="text-body-sm text-secondary tabular-nums truncate">
                      {item.title ? `${item.file.name} · ` : ''}
                      {formatBytes(item.file.size)} · {STATE_LABELS[item.state]}
                      {item.state === 'uploading' ? ` ${item.progress}%` : ''}
                    </span>

                    <div
                      className="h-1 w-full bg-surface-variant rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progresso de ${item.file.name}`}
                    >
                      <motion.span
                        className={`block h-full rounded-full ${BAR_COLOR[item.state]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        transition={SPRING.soft}
                      />
                    </div>

                    {item.error && item.state === 'error' && (
                      <p className="text-body-sm text-error" role="alert">
                        {item.error}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
