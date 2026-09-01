import { formatDateTime, formatRelativeTime } from '../../lib/format';
import type { VideoEvent } from '../../lib/types';

const LABELS: Record<string, string> = {
  'video.uploaded': 'Recebido',
  'video.processing.started': 'Processando',
  'video.processed': 'Concluído',
  'video.failed': 'Falhou',
};

const TONES: Record<string, string> = {
  'video.processed': 'ok',
  'video.failed': 'error',
};

export function EventTimeline({ events }: { events: VideoEvent[] }): JSX.Element {
  if (events.length === 0) {
    return <p className="field__hint">Ainda não há eventos registrados para este vídeo.</p>;
  }

  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id} data-tone={TONES[event.type]}>
          <p className="timeline__label">{LABELS[event.type] ?? event.type}</p>
          <p className="timeline__time">
            <time dateTime={event.createdAt} title={formatDateTime(event.createdAt)}>
              {formatRelativeTime(event.createdAt)}
            </time>
          </p>
        </li>
      ))}
    </ol>
  );
}
