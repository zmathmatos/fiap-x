import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../src/components/AppShell';
import { first, last, renderWithProviders, TEST_USER } from './fixtures';

const KEY = 'fiapx.sidebar';

function renderShell(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<p>conteúdo da biblioteca</p>} />
        <Route path="/upload" element={<p>conteúdo do upload</p>} />
        <Route path="/videos/:id" element={<p>conteúdo do detalhe</p>} />
      </Route>
    </Routes>,
    options,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppShell', () => {
  it('renders the routed page inside the shell', () => {
    renderShell();

    expect(screen.getByText('conteúdo da biblioteca')).toBeInTheDocument();
  });

  it('shows who is signed in', () => {
    renderShell();

    expect(screen.getAllByText(TEST_USER.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(TEST_USER.email).length).toBeGreaterThan(0);
  });

  it('links to every section', () => {
    renderShell();

    const nav = first(screen.getAllByRole('navigation', { name: 'Navegação principal' }));
    expect(within(nav).getByRole('link', { name: /Biblioteca/ })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /Enviar vídeo/ })).toHaveAttribute('href', '/upload');
  });

  it('signs the user out', async () => {
    const logout = vi.fn();
    renderShell({ auth: { logout } });

    await userEvent.click(first(screen.getAllByRole('button', { name: /Sair/ })));

    expect(logout).toHaveBeenCalled();
  });

  it('collapses and expands the rail', async () => {
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Recolher menu' }));

    const expand = screen.getByRole('button', { name: 'Expandir menu' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(KEY)).toBe('collapsed');

    await userEvent.click(expand);

    expect(screen.getByRole('button', { name: 'Recolher menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(window.localStorage.getItem(KEY)).toBe('expanded');
  });

  it('restores the collapsed rail from a previous visit', () => {
    window.localStorage.setItem(KEY, 'collapsed');
    renderShell();

    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
  });

  it('starts expanded when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    renderShell();

    expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument();
  });

  it('still toggles when the choice cannot be persisted', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Recolher menu' }));

    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
  });

  it('keeps the library entry in reach while reading a video', () => {
    renderShell({ route: '/videos/v1' });

    expect(screen.getByText('conteúdo do detalhe')).toBeInTheDocument();
    const nav = first(screen.getAllByRole('navigation', { name: 'Navegação principal' }));
    expect(within(nav).getByRole('link', { name: /Biblioteca/ })).toHaveAttribute('href', '/');
  });

  it('marks the upload entry active on its own route', () => {
    renderShell({ route: '/upload' });

    const nav = first(screen.getAllByRole('navigation', { name: 'Navegação principal' }));
    expect(within(nav).getByRole('link', { name: /Enviar vídeo/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens and closes the phone drawer', async () => {
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const close = await screen.findAllByRole('button', { name: 'Fechar menu' });
    expect(close.length).toBeGreaterThan(0);

    await userEvent.click(first(close));

    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: 'Fechar menu' })).toHaveLength(0),
    );
  });

  it('closes the phone drawer on Escape', async () => {
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await screen.findAllByRole('button', { name: 'Fechar menu' });

    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: 'Fechar menu' })).toHaveLength(0),
    );
  });

  it('signs out from the phone drawer too', async () => {
    const logout = vi.fn();
    renderShell({ auth: { logout } });

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const buttons = await screen.findAllByRole('button', { name: /Sair/ });
    await userEvent.click(last(buttons));

    expect(logout).toHaveBeenCalled();
  });
});
