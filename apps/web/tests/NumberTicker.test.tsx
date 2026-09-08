import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NumberTicker } from '../src/components/NumberTicker';
import { formatBytes, formatCount } from '../src/lib/format';

describe('NumberTicker', () => {
  it('settles on the true formatted value', async () => {
    render(<NumberTicker value={600} format={formatCount} />);

    await waitFor(() => expect(screen.getByText('600')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('runs the value through the same formatter the static views use', async () => {
    render(<NumberTicker value={20_851_589} format={formatBytes} />);

    await waitFor(() => expect(screen.getByText('19.9 MB')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('renders the formatted placeholder for an unknown value without counting', () => {
    render(<NumberTicker value={null} format={formatCount} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('exposes the final value to assistive tech rather than the intermediate frames', () => {
    render(<NumberTicker value={600} format={formatCount} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '600');
  });
});
