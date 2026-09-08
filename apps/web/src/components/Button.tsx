import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-sm rounded-full font-semibold transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

const VARIANT: Record<Variant, string> = {
  default:
    'bg-surface-container-lowest text-on-surface border border-secondary-container hover:bg-surface-container-low',
  primary: 'bg-primary text-on-primary hover:bg-primary-container border border-transparent',
  ghost: 'bg-transparent text-secondary hover:bg-secondary-container/50 border border-transparent',
  danger: 'bg-error text-on-error hover:opacity-90 border border-transparent',
};

const SIZE = {
  sm: 'h-8 px-sm text-body-sm',
  md: 'h-10 px-lg text-body-sm',
};

export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps): JSX.Element {
  const classes = [BASE, VARIANT[variant], SIZE[size], block ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && (
        <span
          className="w-3.5 h-3.5 rounded-circle border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
