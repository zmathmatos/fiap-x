import type { VideoStatus } from '../lib/types';

const LABELS: Record<VideoStatus, string> = {
  PENDING: 'Na fila',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};

const MODIFIERS: Record<VideoStatus, string> = {
  PENDING: 'pill--pending',
  PROCESSING: 'pill--processing',
  COMPLETED: 'pill--completed',
  FAILED: 'pill--failed',
};

const IN_PROGRESS: VideoStatus[] = ['PENDING', 'PROCESSING'];

export function StatusPill({ status }: { status: VideoStatus }): JSX.Element {
  const inProgress = IN_PROGRESS.includes(status);

  return (
    <span
      className={`pill ${MODIFIERS[status]}`}
      // Announced while work is happening; a settled status is read on navigation
      // instead, so screen readers are not interrupted by every poll.
      role={inProgress ? 'status' : undefined}
    >
      <span className="pill__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

export function statusLabel(status: VideoStatus): string {
  return LABELS[status];
}
