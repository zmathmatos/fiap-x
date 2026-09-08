import { motion } from 'motion/react';
import { formatDateTime, formatRelativeTime } from '../../lib/format';
import { DURATION, SPRING } from '../../lib/motion';
import type { VideoEvent } from '../../lib/types';

const LABELS: Record<string, string> = {
  'video.uploaded': 'Recebido',
  'video.processing.started': 'Processando',
  'video.processed': 'Concluído',
  'video.failed': 'Falhou',
};

const DOT: Record<string, string> = {
  'video.processed': 'border-success',
  'video.failed': 'border-error',
};

/** The line reaches each dot just before that dot appears. */
const STEP_S = 0.18;

export function EventTimeline({ events }: { events: VideoEvent[] }): JSX.Element {
  if (events.length === 0) {
    return (
      <p className="text-body-sm text-secondary">
        Ainda não há eventos registrados para este vídeo.
      </p>
    );
  }

  return (
    <div className="relative pl-sm">
      {/*
        Drawing the line downwards rather than fading it in is what makes the
        timeline read as a sequence that happened in that order.
      */}
      <motion.div
        className="absolute left-[3px] top-2 bottom-2 w-px bg-secondary-container origin-top"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: events.length * STEP_S, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      <ol className="flex flex-col gap-lg">
        {events.map((event, index) => (
          <motion.li
            key={event.id}
            className="flex gap-md relative"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * STEP_S, duration: DURATION.base }}
          >
            <motion.span
              className={`w-2 h-2 mt-1 shrink-0 rounded-circle bg-surface border-2 ${DOT[event.type] ?? 'border-tertiary'} -ml-[5px] z-10`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...SPRING.snappy, delay: index * STEP_S }}
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-body-sm font-semibold text-on-surface">
                {LABELS[event.type] ?? event.type}
              </span>
              <time
                dateTime={event.createdAt}
                title={formatDateTime(event.createdAt)}
                className="text-label-caps text-secondary mt-xs"
              >
                {formatRelativeTime(event.createdAt)}
              </time>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
