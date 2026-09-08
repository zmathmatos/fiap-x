import { useId, type InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, ...rest }: FieldProps): JSX.Element {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-xs">
      <label className="text-body-sm text-on-secondary-container" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`field-input ${error ? 'border-error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      {hint && !error && (
        <span className="text-body-sm text-secondary" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="text-body-sm text-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
