import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: '',
  primary: 'button--primary',
  ghost: 'button--ghost',
  danger: 'button--danger',
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
  const classes = [
    'button',
    VARIANT_CLASS[variant],
    size === 'sm' ? 'button--sm' : '',
    block ? 'button--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
