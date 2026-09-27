import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadButton } from '../src/features/videos/DownloadButton';
import { ApiError } from '../src/lib/api-client';
import { downloadZip } from '../src/lib/download';
import { renderWithProviders } from './fixtures';

vi.mock('../src/lib/download', () => ({ downloadZip: vi.fn() }));

const downloadZipMock = vi.mocked(downloadZip);

afterEach(() => {
  vi.clearAllMocks();
});

describe('DownloadButton', () => {
  it('names the zip after the video the user is looking at', async () => {
    downloadZipMock.mockResolvedValue(undefined);
    renderWithProviders(<DownloadButton videoId="v1" originalName="aula" />);

    await userEvent.click(screen.getByRole('button', { name: 'Baixar zip' }));

    expect(downloadZipMock).toHaveBeenCalledWith('v1', 'test-token', 'aula-frames.zip');
  });

  it('does nothing without a session token', async () => {
    renderWithProviders(<DownloadButton videoId="v1" originalName="aula" />, {
      auth: { token: null, user: null, status: 'anonymous' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Baixar zip' }));

    expect(downloadZipMock).not.toHaveBeenCalled();
  });

  it('announces the failure instead of leaving the user waiting', async () => {
    downloadZipMock.mockRejectedValue(new ApiError('Arquivo ainda não está pronto', 409));
    renderWithProviders(<DownloadButton videoId="v1" originalName="aula" />);

    await userEvent.click(screen.getByRole('button', { name: 'Baixar zip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Arquivo ainda não está pronto');
  });

  it('falls back to a generic message when the failure carries none', async () => {
    downloadZipMock.mockRejectedValue('boom');
    renderWithProviders(<DownloadButton videoId="v1" originalName="aula" />);

    await userEvent.click(screen.getByRole('button', { name: 'Baixar zip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha no download.');
  });

  it('clears a previous failure when the user tries again', async () => {
    downloadZipMock.mockRejectedValueOnce(new ApiError('Falhou', 500)).mockResolvedValue(undefined);
    renderWithProviders(<DownloadButton videoId="v1" originalName="aula" />);

    const button = screen.getByRole('button', { name: 'Baixar zip' });
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.click(button);

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
