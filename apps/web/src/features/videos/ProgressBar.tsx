import { motion } from 'motion/react';
import { SPRING } from '../../lib/motion';

interface ProgressBarProps {
  percent: number | null;
  className?: string;
}

/**
 * The bar for a video the worker is still chewing on.
 *
 * The number behind it only refreshes every couple of seconds, so a bar that just
 * jumped and then froze would read as a stall. The spring keeps it travelling
 * between updates and the shimmer keeps it alive even when the number has not
 * moved at all — the two together are what make a slow job look like a working
 * one rather than a stuck one.
 */
export function ProgressBar({ percent, className = '' }: ProgressBarProps): JSX.Element {
  const known = percent !== null;

  return (
    <div
      className={`relative w-full h-1 rounded-full bg-secondary-container overflow-hidden ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? percent : undefined}
      aria-label="Progresso do processamento"
    >
      {known ? (
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={SPRING.soft}
        />
      ) : (
        // Nothing reported yet: sweep a short block instead of implying a number.
        <motion.div
          className="h-full w-1/3 bg-primary rounded-full"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full animate-shimmer motion-reduce:animate-none bg-gradient-to-r from-transparent via-surface-container-lowest/70 to-transparent"
      />
    </div>
  );
}
