import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from '../src/components/Logo';

describe('Logo', () => {
  it('carries an accessible name, so the brand mark is not an unlabelled graphic', () => {
    render(<Logo />);

    expect(screen.getByRole('img', { name: 'FIAP X' })).toBeInTheDocument();
  });

  it('keeps the same name when only the compact mark is shown', () => {
    render(<Logo variant="mark" />);

    expect(screen.getByRole('img', { name: 'FIAP X' })).toBeInTheDocument();
  });

  it('places the X artwork as an image rather than redrawing it', () => {
    const { container } = render(<Logo />);
    const art = container.querySelector('[data-part="mark"]');

    expect(art?.tagName.toLowerCase()).toBe('image');
    expect(art?.getAttribute('href')).toMatch(/fiap-x-mark/);
  });

  it('narrows the viewBox to the X alone in the compact variant', () => {
    const { container } = render(<Logo variant="mark" />);

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '106 0 29 28');
  });

  it('drops the wordmark from the compact mark but keeps the artwork', () => {
    const { container } = render(<Logo variant="mark" />);

    expect(container.querySelector('[data-part="wordmark"]')).toBeNull();
    expect(container.querySelector('[data-part="mark"]')).toBeInTheDocument();
  });

  it('leaves the wordmark on the inherited colour, since only it is tintable', () => {
    const { container } = render(<Logo />);

    expect(container.querySelector('[data-part="wordmark"]')).toHaveAttribute(
      'fill',
      'currentColor',
    );
  });
});
