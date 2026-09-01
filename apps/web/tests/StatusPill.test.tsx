import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from '../src/components/StatusPill';

describe('StatusPill', () => {
  it('renders a readable label for each status', () => {
    render(<StatusPill status="PROCESSING" />);
    expect(screen.getByText('Processando')).toBeInTheDocument();
  });

  it('translates every status into Portuguese', () => {
    const { rerender } = render(<StatusPill status="PENDING" />);
    expect(screen.getByText('Na fila')).toBeInTheDocument();

    rerender(<StatusPill status="COMPLETED" />);
    expect(screen.getByText('Concluído')).toBeInTheDocument();

    rerender(<StatusPill status="FAILED" />);
    expect(screen.getByText('Falhou')).toBeInTheDocument();
  });

  it('marks the pill as a live region only while work is in progress', () => {
    const { rerender } = render(<StatusPill status="PROCESSING" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<StatusPill status="COMPLETED" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
