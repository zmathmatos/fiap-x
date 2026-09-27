import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Thumbnail } from '../src/features/videos/Thumbnail';
import { apiClient } from '../src/lib/api-client';
import { renderWithProviders } from './fixtures';

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Thumbnail', () => {
  it('shows a placeholder while the worker has not produced a poster', () => {
    renderWithProviders(<Thumbnail path={null} frameCount={null} />);

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('fetches the poster behind the bearer token', async () => {
    const fetchThumbnail = vi.spyOn(apiClient, 'fetchThumbnail').mockResolvedValue('blob:poster');

    renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={null} />);

    await waitFor(() =>
      expect(fetchThumbnail).toHaveBeenCalledWith(
        '/videos/v1/thumb',
        expect.objectContaining({ token: 'test-token' }),
      ),
    );
  });

  it('renders the poster once it arrives', async () => {
    vi.spyOn(apiClient, 'fetchThumbnail').mockResolvedValue('blob:poster');

    renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={null} />);

    const image = await screen.findByRole('presentation');
    expect(image).toHaveAttribute('src', 'blob:poster');
  });

  it('stamps the frame count over the poster', async () => {
    vi.spyOn(apiClient, 'fetchThumbnail').mockResolvedValue('blob:poster');

    renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={120} />);

    expect(await screen.findByText('120 frames')).toBeInTheDocument();
  });

  it('leaves the badge off when there are no frames to announce', async () => {
    vi.spyOn(apiClient, 'fetchThumbnail').mockResolvedValue('blob:poster');

    renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={0} />);

    await screen.findByRole('presentation');
    expect(screen.queryByText(/frames/)).toBeNull();
  });

  it('keeps the placeholder when the poster cannot be fetched', async () => {
    vi.spyOn(apiClient, 'fetchThumbnail').mockRejectedValue(new Error('404'));

    renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={null} />);

    await waitFor(() => expect(apiClient.fetchThumbnail).toHaveBeenCalled());
    expect(screen.queryByRole('presentation')).toBeNull();
  });

  it('asks for nothing while there is no session', () => {
    const fetchThumbnail = vi.spyOn(apiClient, 'fetchThumbnail');

    renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={null} />, {
      auth: { token: null },
    });

    expect(fetchThumbnail).not.toHaveBeenCalled();
  });

  it('releases the blob url when the row leaves the screen', async () => {
    vi.spyOn(apiClient, 'fetchThumbnail').mockResolvedValue('blob:poster');

    const { unmount } = renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={null} />);
    await screen.findByRole('presentation');

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:poster');
  });

  it('throws away a poster that arrived after the row was gone', async () => {
    let resolve: (url: string) => void = () => undefined;
    vi.spyOn(apiClient, 'fetchThumbnail').mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { unmount } = renderWithProviders(<Thumbnail path="/videos/v1/thumb" frameCount={null} />);
    unmount();
    resolve('blob:late');

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late'));
  });
});
