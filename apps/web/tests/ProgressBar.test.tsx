import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../src/features/videos/ProgressBar';

describe('ProgressBar', () => {
  it('exposes the reported percentage to assistive tech', () => {
    render(<ProgressBar percent={42} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('omits the value while the worker has reported nothing', () => {
    render(<ProgressBar percent={null} />);

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('is labelled so the bar is not read as an anonymous widget', () => {
    render(<ProgressBar percent={10} />);

    expect(screen.getByRole('progressbar', { name: 'Progresso do processamento' })).toBeInTheDocument();
  });

  it('accepts extra classes from the caller', () => {
    render(<ProgressBar percent={10} className="mt-sm" />);

    expect(screen.getByRole('progressbar')).toHaveClass('mt-sm');
  });

  it('reports zero as a real value rather than as unknown', () => {
    render(<ProgressBar percent={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
