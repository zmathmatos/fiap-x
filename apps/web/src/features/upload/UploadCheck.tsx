import { motion } from 'motion/react';

/**
 * A check mark that draws itself once, when an upload lands.
 *
 * A static tick would be missed among rows that are all changing at once; the
 * stroke drawing is what marks *this* file as the one that just finished.
 */
export function UploadCheck(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 shrink-0 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M4 12.5 L9.5 18 L20 6"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </svg>
  );
}
