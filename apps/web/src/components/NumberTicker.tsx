import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

interface NumberTickerProps {
  value: number | null;
  format: (value: number | null) => string;
  durationSeconds?: number;
}

export function NumberTicker({
  value,
  format,
  durationSeconds = 0.9,
}: NumberTickerProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(() => format(value === null ? null : 0));

  useEffect(() => {
    if (value === null) {
      setDisplay(format(null));
      return;
    }

    if (reduceMotion) {
      setDisplay(format(value));
      return;
    }

    const controls = animate(0, value, {
      duration: durationSeconds,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(format(latest)),
      onComplete: () => setDisplay(format(value)),
    });

    return () => controls.stop();
  }, [value, format, durationSeconds, reduceMotion]);

  return (
    <span role="status" aria-label={format(value)} className="tabular-nums">
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
