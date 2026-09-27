import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadPage } from '../src/features/upload/UploadPage';
import type { UploadItem, UseUploadQueueResult } from '../src/features/upload/useUploadQueue';
import { first, renderWithProviders } from './fixtures';

const queue = vi.hoisted(() => ({ current: null as unknown as UseUploadQueueResult }));

vi.mock('../src/features/upload/useUploadQueue', () => ({
  useUploadQueue: () => queue.current,
}));

function uploadItem(overrides: Partial<UploadItem> = {}): UploadItem {
  const file = new File(['bytes'], 'aula.mp4', { type: 'video/mp4' });
  Object.defineProperty(file, 'size', { value: 5_242_880 });

  return {
    id: 'i1',
    file,
    progress: 0,
    state: 'queued',
    displayName: 'aula.mp4',
    ...overrides,
  };
}

function setQueue(overrides: Partial<UseUploadQueueResult> = {}): UseUploadQueueResult {
  queue.current = {
    items: [],
    enqueue: vi.fn(),
    rename: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
    clearFinished: vi.fn(),
    activeCount: 0,
    ...overrides,
  };
  return queue.current;
}

beforeEach(() => {
  setQueue();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('UploadPage', () => {
  it('starts on the default interval and projects the frame count', () => {
    renderWithProviders(<UploadPage />);

    expect(screen.getByLabelText('Extrair 1 frame a cada')).toHaveValue('20');
    expect(screen.getByText('30 frames')).toBeInTheDocument();
  });

  it('recalculates the projection when the interval changes', async () => {
    renderWithProviders(<UploadPage />);

    await userEvent.selectOptions(screen.getByLabelText('Extrair 1 frame a cada'), '5');

    expect(screen.getByText('120 frames')).toBeInTheDocument();
  });

  it('enqueues the dropped files with the chosen interval', async () => {
    const enqueue = vi.fn();
    setQueue({ enqueue });
    renderWithProviders(<UploadPage />);

    await userEvent.selectOptions(screen.getByLabelText('Extrair 1 frame a cada'), '10');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['bytes'], 'aula.mp4', { type: 'video/mp4' }));

    expect(enqueue).toHaveBeenCalledWith([expect.any(File)], 10);
  });

  it('shows no queue panel before anything was sent', () => {
    renderWithProviders(<UploadPage />);

    expect(screen.queryByText(/Fila de upload/)).toBeNull();
  });

  it('lists the queued files with size and state', () => {
    setQueue({ items: [uploadItem({ state: 'queued' })] });
    renderWithProviders(<UploadPage />);

    expect(screen.getByText(/Fila de upload \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 MB · Na fila/)).toBeInTheDocument();
  });

  it('shows the percentage only while a file is going up', () => {
    setQueue({ items: [uploadItem({ state: 'uploading', progress: 42 })] });
    renderWithProviders(<UploadPage />);

    expect(screen.getByText(/Enviando 42%/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progresso de aula.mp4' })).toHaveAttribute(
      'aria-valuenow',
      '42',
    );
  });

  it('counts the uploads in flight', () => {
    setQueue({ activeCount: 2 });
    renderWithProviders(<UploadPage />);

    expect(screen.getByText('2 envios em andamento')).toBeInTheDocument();
  });

  it('uses the singular for a lone upload', () => {
    setQueue({ activeCount: 1 });
    renderWithProviders(<UploadPage />);

    expect(screen.getByText('1 envio em andamento')).toBeInTheDocument();
  });

  it('cancels the upload the user asked to stop', async () => {
    const cancel = vi.fn();
    setQueue({ items: [uploadItem({ state: 'uploading', progress: 10 })], cancel });
    renderWithProviders(<UploadPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(cancel).toHaveBeenCalledWith('i1');
  });

  it('offers no cancel once the file has landed', () => {
    setQueue({ items: [uploadItem({ state: 'done', progress: 100, videoId: 'v1' })] });
    renderWithProviders(<UploadPage />);

    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('links a finished upload to the video it became', () => {
    setQueue({ items: [uploadItem({ state: 'done', progress: 100, videoId: 'v1' })] });
    renderWithProviders(<UploadPage />);

    expect(screen.getByRole('link', { name: 'Acompanhar' })).toHaveAttribute('href', '/videos/v1');
  });

  it('clears the finished uploads on request', async () => {
    const clearFinished = vi.fn();
    setQueue({ items: [uploadItem({ state: 'done', progress: 100 })], clearFinished });
    renderWithProviders(<UploadPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Limpar concluídos' }));

    expect(clearFinished).toHaveBeenCalled();
  });

  it('keeps the clear button away while nothing has finished', () => {
    setQueue({ items: [uploadItem({ state: 'uploading' })] });
    renderWithProviders(<UploadPage />);

    expect(screen.queryByRole('button', { name: 'Limpar concluídos' })).toBeNull();
  });

  it('shows the reason a file failed', () => {
    setQueue({ items: [uploadItem({ state: 'error', error: 'Arquivo grande demais.' })] });
    renderWithProviders(<UploadPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Arquivo grande demais.');
  });

  it('shows the original file name next to a renamed upload', () => {
    setQueue({ items: [uploadItem({ title: 'Aula 1', displayName: 'Aula 1' })] });
    renderWithProviders(<UploadPage />);

    expect(screen.getByText(/aula\.mp4 · 5\.0 MB/)).toBeInTheDocument();
  });

  it('hands a typed name to the queue', async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    setQueue({ items: [uploadItem()], rename });
    renderWithProviders(<UploadPage />);

    const panel = screen.getByText(/Fila de upload/).closest('div')?.parentElement as HTMLElement;
    await userEvent.click(first(within(panel).getAllByRole('button', { name: /aula\.mp4/ })));

    const input = within(panel).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Aula 1{Enter}');

    expect(rename).toHaveBeenCalledWith('i1', 'Aula 1');
  });
});
