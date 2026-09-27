import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../src/components/ThemeToggle';

const KEY = 'fiapx.theme';

function stubMatchMedia(matches: boolean): { listeners: (() => void)[] } {
  const listeners: (() => void)[] = [];

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: (_: string, handler: () => void) => listeners.push(handler),
      removeEventListener: vi.fn(),
    }),
  );

  return { listeners };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('starts on automatic when nothing was chosen before', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button')).toHaveAccessibleName(/Autom[áa]tico/);
  });

  it('resolves automatic against the OS preference', () => {
    stubMatchMedia(true);
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('falls back to light when the OS reports no preference', () => {
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('cycles automatic, light, dark and back', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    await userEvent.click(button);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem(KEY)).toBe('light');

    await userEvent.click(button);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(KEY)).toBe('dark');

    await userEvent.click(button);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('restores the stored choice', () => {
    window.localStorage.setItem(KEY, 'dark');
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button')).toHaveAccessibleName(/Escuro/);
  });

  it('ignores a stored value it does not recognise', () => {
    window.localStorage.setItem(KEY, 'neon');
    render(<ThemeToggle />);

    expect(screen.getByRole('button')).toHaveAccessibleName(/Autom[áa]tico/);
  });

  it('falls back to automatic when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    render(<ThemeToggle />);

    expect(screen.getByRole('button')).toHaveAccessibleName(/Autom[áa]tico/);
  });

  it('keeps working when the preference cannot be persisted', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('follows the OS while the choice is automatic', () => {
    const { listeners } = stubMatchMedia(false);
    render(<ThemeToggle />);

    expect(listeners).toHaveLength(1);
  });

  it('stops following the OS once a theme was picked by hand', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));

    const { listeners } = stubMatchMedia(false);
    expect(listeners).toHaveLength(0);
  });

  it('hides the label when the sidebar is collapsed', () => {
    render(<ThemeToggle collapsed />);

    expect(screen.queryByText(/Tema:/)).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute('title', expect.stringContaining('Tema:'));
  });
});
