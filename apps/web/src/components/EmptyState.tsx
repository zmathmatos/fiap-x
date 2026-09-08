import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center text-center px-lg py-xl">
      <p className="text-body-lg text-on-surface">{title}</p>
      <p className="text-body-sm text-secondary mt-xs max-w-md">{body}</p>
      {action && <div className="mt-lg">{action}</div>}
    </div>
  );
}
