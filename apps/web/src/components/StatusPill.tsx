import type { VideoStatus } from '../lib/types';

const LABELS: Record<VideoStatus, string> = {
  PENDING: 'Na fila',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};

const DOT: Record<VideoStatus, string> = {
  PENDING: 'bg-secondary',
  PROCESSING: 'bg-tertiary-container',
  COMPLETED: 'bg-success',
  FAILED: 'bg-error',
};

const TEXT: Record<VideoStatus, string> = {
  PENDING: 'text-secondary',
  PROCESSING: 'text-tertiary-container',
  COMPLETED: 'text-success',
  FAILED: 'text-error',
};

const IN_PROGRESS: VideoStatus[] = ['PENDING', 'PROCESSING'];

export function StatusPill({ status }: { status: VideoStatus }): JSX.Element {
  const inProgress = IN_PROGRESS.includes(status);

  return (
    <span
      className={`inline-flex items-center gap-xs text-label-caps uppercase whitespace-nowrap ${TEXT[status]}`}
      role={inProgress ? 'status' : undefined}
    >
      <span className="relative flex w-1.5 h-1.5 shrink-0">
        {}
        {status === 'PROCESSING' && (
          <span
            className={`absolute inset-0 rounded-circle ${DOT[status]} animate-ping-slow motion-reduce:animate-none`}
            aria-hidden="true"
          />
        )}
        <span className={`relative w-1.5 h-1.5 rounded-circle ${DOT[status]}`} aria-hidden="true" />
      </span>
      {LABELS[status]}
    </span>
  );
}

export function statusLabel(status: VideoStatus): string {
  return LABELS[status];
}
