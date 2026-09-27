import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoLibraryPage } from '../src/features/videos/VideoLibraryPage';
import { apiClient } from '../src/lib/api-client';
import { first, renderWithProviders, videoSummary } from './fixtures';

function page(items = [videoSummary()], total = items.length) {
  return { items, total, page: 1, limit: 20 };
}

beforeEach(() => {
  vi.spyOn(apiClient, 'listVideos').mockResolvedValue(page());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VideoLibraryPage', () => {
  it('lists the videos the API returned', async () => {
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(
      page([videoSummary({ id: 'v1', displayName: 'aula.mp4' })]),
    );

    renderWithProviders(<VideoLibraryPage />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByText('aula.mp4').length).toBeGreaterThan(0);
  });

  it('invites the first upload when the library is empty', async () => {
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(page([], 0));

    renderWithProviders(<VideoLibraryPage />);

    expect(await screen.findByText('Nenhum vídeo por aqui ainda')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Enviar vídeo/ }).length).toBeGreaterThan(0);
  });

  it('explains an empty result that came from a filter, not from an empty library', async () => {
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(page([], 0));

    renderWithProviders(<VideoLibraryPage />);
    await screen.findByText('Nenhum vídeo por aqui ainda');

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por status'), 'FAILED');

    expect(await screen.findByText('Nenhum vídeo com esse filtro')).toBeInTheDocument();
  });

  it('asks the API for the chosen status', async () => {
    const list = vi.spyOn(apiClient, 'listVideos').mockResolvedValue(page());
    renderWithProviders(<VideoLibraryPage />);
    await screen.findByRole('table');

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por status'), 'PROCESSING');

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'PROCESSING' })),
    );
  });

  it('asks the API for the typed search', async () => {
    const list = vi.spyOn(apiClient, 'listVideos').mockResolvedValue(page());
    renderWithProviders(<VideoLibraryPage />);
    await screen.findByRole('table');

    await userEvent.type(screen.getByLabelText(/Buscar por nome/), 'aula');

    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'aula' })));
  });

  it('counts how many videos are still moving', async () => {
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(
      page([
        videoSummary({ id: 'v1', status: 'PROCESSING' }),
        videoSummary({ id: 'v2', status: 'PENDING' }),
        videoSummary({ id: 'v3', status: 'COMPLETED' }),
      ]),
    );

    renderWithProviders(<VideoLibraryPage />);

    expect(await screen.findByText(/2 vídeos em andamento/)).toBeInTheDocument();
  });

  it('uses the singular for a single video in flight', async () => {
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(
      page([videoSummary({ id: 'v1', status: 'PROCESSING' })]),
    );

    renderWithProviders(<VideoLibraryPage />);

    expect(await screen.findByText(/1 vídeo em andamento/)).toBeInTheDocument();
  });

  it('says the library is idle when nothing is running', async () => {
    renderWithProviders(<VideoLibraryPage />);

    expect(await screen.findByText('Todos os vídeos enviados por você.')).toBeInTheDocument();
  });

  it('surfaces a load failure without hiding the filters', async () => {
    vi.spyOn(apiClient, 'listVideos').mockRejectedValue(new Error('API fora do ar'));

    renderWithProviders(<VideoLibraryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('API fora do ar');
    expect(screen.getByLabelText('Filtrar por status')).toBeInTheDocument();
  });

  it('hides the pagination while everything fits on one page', async () => {
    renderWithProviders(<VideoLibraryPage />);
    await screen.findByRole('table');

    expect(screen.queryByRole('navigation', { name: 'Paginação' })).toBeNull();
  });

  it('walks through pages and asks the API for each one', async () => {
    const list = vi
      .spyOn(apiClient, 'listVideos')
      .mockResolvedValue(page([videoSummary()], 45));

    renderWithProviders(<VideoLibraryPage />);
    await screen.findByRole('table');

    const nav = screen.getByRole('navigation', { name: 'Paginação' });
    expect(within(nav).getByText('Página 1 de 3')).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await userEvent.click(within(nav).getByRole('button', { name: 'Próxima página' }));

    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
    expect(within(nav).getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('stops at the last page', async () => {
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(page([videoSummary()], 25));

    renderWithProviders(<VideoLibraryPage />);
    await screen.findByRole('table');

    const nav = screen.getByRole('navigation', { name: 'Paginação' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Próxima página' }));

    expect(within(nav).getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });

  it('sends a rename to the API and reloads the list', async () => {
    const rename = vi.spyOn(apiClient, 'renameVideo').mockResolvedValue(videoSummary());
    vi.spyOn(apiClient, 'listVideos').mockResolvedValue(
      page([videoSummary({ id: 'v1', displayName: 'aula.mp4' })]),
    );

    renderWithProviders(<VideoLibraryPage />);
    const table = await screen.findByRole('table');

    await userEvent.click(first(within(table).getAllByRole('button', { name: /aula\.mp4/ })));
    const input = within(table).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Aula 1{Enter}');

    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith('v1', 'Aula 1', expect.objectContaining({ token: 'test-token' })),
    );
  });
});
