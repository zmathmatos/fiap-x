import markUrl from '../assets/fiap-x-mark.png';

interface LogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

const WORDMARK =
  'M30.906.205h-2.68v27.301h2.68zM17.667 12.929H7.344v2.537h10.323zM0 27.506h2.671V2.742h20.421V.205H0zM89.786.1H73.742v27.3h2.68V2.636h13.22c4.808 0 7.675 2.264 7.675 6.062v.076c0 3.692-3.177 6.176-7.9 6.176H82.85v2.537h6.452c7.388 0 10.693-4.436 10.693-8.827v-.076C99.996 3.191 96.276.1 89.794.1zM53.631 0h-2.286L34.53 27.491h2.876l15.047-24.3 7.743 12.48h3.064zM62.813 19.872l4.739 7.62h2.988l-4.686-7.62z';
const CAP_TOP = 0.205;
const CAP_HEIGHT = 27.301;
const MARK_W = CAP_HEIGHT * 0.9688;
const MARK_X = 107;

export function Logo({ variant = 'full', className = '' }: LogoProps): JSX.Element {
  const mark = variant === 'mark';

  return (
    <svg
      viewBox={mark ? '106 0 29 28' : '0 0 135 28'}
      className={className}
      fill="none"
      role="img"
      aria-label="FIAP X"
    >
      {!mark && <path data-part="wordmark" fill="currentColor" d={WORDMARK} />}
      <image
        data-part="mark"
        href={markUrl}
        x={MARK_X}
        y={CAP_TOP}
        width={MARK_W}
        height={CAP_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
