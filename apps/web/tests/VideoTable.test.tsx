import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoTable } from '../src/features/videos/VideoTable';
import { first, Providers, renderWithProviders, videoSummary } from './fixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

function table(): HTMLElement {
  return screen.getByRole('table');
}

describe('VideoTable', () => {
  it('renders one row per video', () => {
    renderWithProviders(
      <VideoTable
        videos={[
          videoSummary({ id: 'v1', displayName: 'aula.mp4' }),
          videoSummary({ id: 'v2', displayName: 'palestra.mp4' }),
        ]}
        onRename={vi.fn()}
      />,
    );

    const rows = within(table()).getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('shows the file name under the title once the video was renamed', () => {
    renderWithProviders(
      <VideoTable
        videos={[videoSummary({ title: 'Aula 1', displayName: 'Aula 1', originalName: 'aula.mp4' })]}
        onRename={vi.fn()}
      />,
    );

    expect(within(table()).getByText('aula.mp4')).toBeInTheDocument();
  });

  it('does not repeat the file name when it is also the display name', () => {
    renderWithProviders(
      <VideoTable videos={[videoSummary({ title: null, displayName: 'aula.mp4' })]} onRename={vi.fn()} />,
    );

    const row = first(within(table()).getAllByRole('row').slice(1));
    expect(within(row).getAllByText('aula.mp4')).toHaveLength(1);
  });

  it('offers the download only for a video that has a zip', () => {
    renderWithProviders(
      <VideoTable videos={[videoSummary({ downloadable: true })]} onRename={vi.fn()} />,
    );

    expect(within(table()).getByRole('button', { name: 'Baixar zip' })).toBeInTheDocument();
  });

  it('links to the detail page while there is nothing to download', () => {
    renderWithProviders(
      <VideoTable
        videos={[videoSummary({ id: 'v9', status: 'PENDING', downloadable: false })]}
        onRename={vi.fn()}
      />,
    );

    const link = within(table()).getByRole('link', { name: 'Detalhes' });
    expect(link).toHaveAttribute('href', '/videos/v9');
  });

  it('shows a progress bar only while the worker is running', () => {
    const { rerender } = renderWithProviders(
      <VideoTable
        videos={[videoSummary({ status: 'PROCESSING', progressPercent: 40 })]}
        onRename={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);

    rerender(
      <Providers>
        <VideoTable videos={[videoSummary({ status: 'COMPLETED' })]} onRename={vi.fn()} />
      </Providers>,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('hands the new title to the caller', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <VideoTable videos={[videoSummary({ id: 'v1', displayName: 'aula.mp4' })]} onRename={onRename} />,
    );

    const trigger = first(within(table()).getAllByRole('button', { name: /aula\.mp4/ }));
    await userEvent.click(trigger);

    const input = within(table()).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Aula de física{Enter}');

    expect(onRename).toHaveBeenCalledWith('v1', 'Aula de física');
  });

  it('formats duration, frames and size for reading', () => {
    renderWithProviders(
      <VideoTable
        videos={[videoSummary({ durationMs: 90_000, frameCount: 1200, sizeBytes: 5_242_880 })]}
        onRename={vi.fn()}
      />,
    );

    const row = first(within(table()).getAllByRole('row').slice(1));
    expect(within(row).getByText('1:30')).toBeInTheDocument();
    expect(within(row).getByText('1.200')).toBeInTheDocument();
    expect(within(row).getByText('5.0 MB')).toBeInTheDocument();
  });

  it('renders the same videos as cards for small screens', () => {
    renderWithProviders(
      <VideoTable videos={[videoSummary({ displayName: 'aula.mp4' })]} onRename={vi.fn()} />,
    );

    const cards = screen.getByRole('list');
    expect(within(cards).getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders an empty table without blowing up', () => {
    renderWithProviders(<VideoTable videos={[]} onRename={vi.fn()} />);

    expect(within(table()).getAllByRole('row')).toHaveLength(1);
  });
});
