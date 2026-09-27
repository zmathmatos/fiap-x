import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { AuthContext } from '../src/features/auth/AuthProvider';
import { apiClient } from '../src/lib/api-client';
import { authValue, videoDetail } from './fixtures';
import type { AuthContextValue } from '../src/features/auth/AuthProvider';

function renderApp(auth: Partial<AuthContextValue>, route = '/'): void {
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={authValue(auth)}>
        <App />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(apiClient, 'listVideos').mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  vi.spyOn(apiClient, 'getVideo').mockResolvedValue(videoDetail());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('holds the screen while the stored session is being checked', () => {
    renderApp({ status: 'loading', token: 'stored', user: null });

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Entrar' })).toBeNull();
  });

  it('shows the login screen to an anonymous visitor', () => {
    renderApp({ status: 'anonymous', token: null, user: null });

    expect(screen.getByRole('tab', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sends an anonymous visitor to login whatever route they asked for', () => {
    renderApp({ status: 'anonymous', token: null, user: null }, '/upload');

    expect(screen.getByRole('tab', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('opens the library for a signed-in user', async () => {
    renderApp({});

    expect(await screen.findByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
  });

  it('routes to the upload page', async () => {
    renderApp({}, '/upload');

    expect(await screen.findByRole('heading', { name: 'Enviar vídeo' })).toBeInTheDocument();
  });

  it('routes to a video detail', async () => {
    renderApp({}, '/videos/v1');

    expect(await screen.findByRole('navigation', { name: 'Trilha' })).toBeInTheDocument();
  });

  it('bounces a signed-in user away from the login route', async () => {
    renderApp({}, '/login');

    expect(await screen.findByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
  });

  it('sends an unknown route back to the library', async () => {
    renderApp({}, '/rota-que-nao-existe');

    expect(await screen.findByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
  });
});
