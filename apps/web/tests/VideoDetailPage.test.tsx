import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoDetailPage } from '../src/features/videos/VideoDetailPage';
import { apiClient } from '../src/lib/api-client';
import { first, renderWithProviders, videoDetail, videoSummary } from './fixtures';

function renderDetail(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/videos/:id" element={<VideoDetailPage />} />
    </Routes>,
    { route: '/videos/v1' },
  );
}

beforeEach(() => {
  vi.spyOn(apiClient, 'getVideo').mockResolvedValue(videoDetail());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VideoDetailPage', () => {
  it('asks the API for the video in the url', async () => {
    const get = vi.spyOn(apiClient, 'getVideo').mockResolvedValue(videoDetail());

    renderDetail();

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('v1', expect.objectContaining({ token: 'test-token' })),
    );
  });

  it('announces the load to assistive tech before the data arrives', () => {
    renderDetail();

    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('shows the four figures the page exists for', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ durationMs: 90_000, frameCount: 120, sizeBytes: 5_242_880, frameIntervalSeconds: 20 }),
    );

    renderDetail();

    expect(await screen.findByText('Duração')).toBeInTheDocument();
    expect(screen.getByText('Frames')).toBeInTheDocument();
    expect(screen.getByText('Zip')).toBeInTheDocument();
    expect(screen.getByText('Intervalo')).toBeInTheDocument();
  });

  it('puts the video in a breadcrumb back to the library', async () => {
    renderDetail();

    const nav = await screen.findByRole('navigation', { name: 'Trilha' });
    expect(within(nav).getByRole('link', { name: 'Biblioteca' })).toHaveAttribute('href', '/');
  });

  it('offers the download once the zip exists', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(videoDetail({ downloadable: true }));

    renderDetail();

    expect(await screen.findByRole('button', { name: 'Baixar zip' })).toBeInTheDocument();
  });

  it('hides the download while there is no zip', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ status: 'PENDING', downloadable: false }),
    );

    renderDetail();

    await screen.findByRole('navigation', { name: 'Trilha' });
    expect(screen.queryByRole('button', { name: 'Baixar zip' })).toBeNull();
  });

  it('shows the progress bar only while frames are being extracted', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ status: 'PROCESSING', progressPercent: 30, downloadable: false }),
    );

    renderDetail();

    expect(await screen.findByText('Extraindo frames')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  it('explains why a video failed', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ status: 'FAILED', errorReason: 'ffmpeg não decodificou o arquivo.', downloadable: false }),
    );

    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('ffmpeg não decodificou o arquivo.');
  });

  it('shows the technical panel when the worker read the metadata', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ codec: 'h264', width: 1920, height: 1080, frameRate: 30, bitrateBps: 2_000_000 }),
    );

    renderDetail();

    expect(await screen.findByText('Informações técnicas')).toBeInTheDocument();
    expect(screen.getByText('h264')).toBeInTheDocument();
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });

  it('drops the technical panel when there is no metadata at all', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ codec: null, width: null, height: null, frameRate: null, bitrateBps: null }),
    );

    renderDetail();

    await screen.findByRole('navigation', { name: 'Trilha' });
    expect(screen.queryByText('Informações técnicas')).toBeNull();
  });

  it('shows the file name beside a renamed video', async () => {
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({ title: 'Aula 1', displayName: 'Aula 1', originalName: 'aula.mp4' }),
    );

    renderDetail();

    expect(await screen.findByText(/aula\.mp4 ·/)).toBeInTheDocument();
  });

  it('sends a rename and keeps the timeline it already had', async () => {
    const rename = vi
      .spyOn(apiClient, 'renameVideo')
      .mockResolvedValue(videoSummary({ title: 'Aula 1', displayName: 'Aula 1' }));
    vi.spyOn(apiClient, 'getVideo').mockResolvedValue(
      videoDetail({
        events: [
          { id: 'e1', type: 'video.uploaded', payload: {}, createdAt: '2026-09-27T10:00:00.000Z' },
        ],
      }),
    );

    renderDetail();
    await screen.findByRole('navigation', { name: 'Trilha' });

    await userEvent.click(first(screen.getAllByRole('button', { name: /aula\.mp4/ })));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Aula 1{Enter}');

    await waitFor(() => expect(rename).toHaveBeenCalledWith('v1', 'Aula 1', expect.anything()));
  });

  it('shows the failure and a way back when the video cannot be loaded', async () => {
    vi.spyOn(apiClient, 'getVideo').mockRejectedValue(new Error('Vídeo não encontrado'));

    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Vídeo não encontrado');
    expect(screen.getByRole('link', { name: 'Voltar para a biblioteca' })).toHaveAttribute('href', '/');
  });

  it('keeps polling while the video can still change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = vi
      .spyOn(apiClient, 'getVideo')
      .mockResolvedValue(videoDetail({ status: 'PROCESSING', downloadable: false }));

    renderDetail();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));

    vi.useRealTimers();
  });

  it('stops polling once the video reached a final state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = vi.spyOn(apiClient, 'getVideo').mockResolvedValue(videoDetail({ status: 'COMPLETED' }));

    renderDetail();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(6000);
    expect(get).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
