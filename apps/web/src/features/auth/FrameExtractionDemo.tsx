import { motion } from 'motion/react';

/** One full pass: scan, frames fall out, zip lands, breathe. */
const CYCLE_S = 7;
const FRAMES = 5;

/** Where each frame lands in the stack, as a fraction of the strip's width. */
const SLOT_X = (index: number): number => index * 46;

/**
 * The product, animated.
 *
 * Someone arriving at the login screen has no idea what this tool does. Rather
 * than telling them in a paragraph, the screen shows it: a video is scanned, frames
 * drop out of it one by one, and they land in a zip. The whole value proposition
 * plays out in seven seconds without a word.
 *
 * It is decorative, so it is `aria-hidden` — the copy beside it carries the same
 * message for anyone who is not looking at pictures.
 */
export function FrameExtractionDemo(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[380px] aspect-[4/3] select-none pointer-events-none"
    >
      {/* The source video */}
      <motion.div
        className="absolute left-0 top-0 w-[220px] h-[124px] rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-sm"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: CYCLE_S, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary-container/15 to-tertiary/10" />

        <span className="absolute inset-0 grid place-items-center">
          <span className="w-9 h-9 rounded-circle bg-primary-container/90 grid place-items-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 translate-x-[1px]" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>

        {/* The scan head that sweeps the video before each batch of frames */}
        <motion.span
          className="absolute inset-y-0 w-[2px] bg-primary-container"
          style={{ boxShadow: '0 0 12px rgb(var(--primary-container))' }}
          animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: CYCLE_S * 0.42,
            repeat: Infinity,
            repeatDelay: CYCLE_S * 0.58,
            ease: 'linear',
          }}
        />

        <span className="absolute bottom-0 inset-x-0 h-[3px] bg-secondary-container">
          <motion.span
            className="block h-full bg-primary-container"
            animate={{ width: ['0%', '100%', '100%', '0%'] }}
            transition={{ duration: CYCLE_S, repeat: Infinity, times: [0, 0.42, 0.92, 1] }}
          />
        </span>
      </motion.div>

      {/* The frames coming out of it */}
      {Array.from({ length: FRAMES }, (_, index) => {
        const start = 0.12 + index * 0.06;

        return (
          <motion.span
            key={index}
            className="absolute left-[26px] top-[46px] w-10 h-7 rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0, 1, 1, 1, 0],
              x: [0, 0, 10, SLOT_X(index) + 40, SLOT_X(index) + 40, SLOT_X(index) + 40],
              y: [0, 0, 30, 128, 128, 128],
              rotate: [0, 0, -6, 0, 0, 0],
              scale: [0.8, 0.8, 1, 1, 1, 0.9],
            }}
            transition={{
              duration: CYCLE_S,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, start, start + 0.08, start + 0.2, 0.9, 1],
            }}
          >
            <span className="absolute inset-x-1 top-1 bottom-1 rounded bg-gradient-to-br from-primary-container/20 to-tertiary/15" />
          </motion.span>
        );
      })}

      {/* Where they land */}
      <motion.div
        className="absolute left-[52px] bottom-[6px] flex items-center gap-sm px-md h-11 rounded-full border border-outline-variant bg-surface-container-lowest shadow-sm"
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.9, 0.9, 1.04, 1, 0.96] }}
        transition={{
          duration: CYCLE_S,
          repeat: Infinity,
          ease: 'easeOut',
          times: [0, 0.44, 0.52, 0.9, 1],
        }}
      >
        <span className="material-symbols-outlined text-[20px] text-primary-container">
          folder_zip
        </span>
        <span className="text-body-sm font-semibold text-on-surface">frames.zip</span>
      </motion.div>
    </div>
  );
}
