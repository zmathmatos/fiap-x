import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const renameVideo = vi.fn().mockResolvedValue({});
const uploadWithProgress = vi.fn();

vi.mock('../src/lib/api-client', () => ({
  apiClient: { renameVideo: (...args: unknown[]) => renameVideo(...args) },
}));

vi.mock('../src/features/auth/useAuth', () => ({
  useAuth: () => ({ token: 'tok', logout: vi.fn() }),
}));

vi.mock('../src/features/upload/uploadWithProgress', () => ({
  uploadWithProgress: (...args: unknown[]) => uploadWithProgress(...args),
}));

const { useUploadQueue } = await import('../src/features/upload/useUploadQueue');

function file(name = 'clip.mp4'): File {
  return new File(['x'], name, { type: 'video/mp4' });
}

describe('useUploadQueue naming', () => {
  beforeEach(() => {
    renameVideo.mockClear();
    uploadWithProgress.mockReset();
  });

  it('shows the file name until the user types one', async () => {
    uploadWithProgress.mockResolvedValue({ id: 'v1' });
    const { result } = renderHook(() => useUploadQueue());

    act(() => result.current.enqueue([file('bruto.mp4')]));

    expect(result.current.items[0]?.displayName).toBe('bruto.mp4');
  });

  it('renames a finished upload straight away', async () => {
    uploadWithProgress.mockResolvedValue({ id: 'v1' });
    const { result } = renderHook(() => useUploadQueue());

    act(() => result.current.enqueue([file()]));
    await waitFor(() => expect(result.current.items[0]?.state).toBe('done'));

    await act(async () => {
      await result.current.rename(result.current.items[0]!.id, 'Aula 02');
    });

    expect(renameVideo).toHaveBeenCalledWith('v1', 'Aula 02', expect.anything());
    expect(result.current.items[0]?.displayName).toBe('Aula 02');
  });

  it('holds a name typed mid-upload and applies it once the id arrives', async () => {
    let finish: (video: { id: string }) => void = () => undefined;
    uploadWithProgress.mockImplementation(
      () => new Promise<{ id: string }>((resolve) => (finish = resolve)),
    );

    const { result } = renderHook(() => useUploadQueue());
    act(() => result.current.enqueue([file()]));
    await waitFor(() => expect(result.current.items[0]?.state).toBe('uploading'));

    await act(async () => {
      await result.current.rename(result.current.items[0]!.id, 'Enquanto sobe');
    });

    // Nothing to rename yet — the server does not know about this video.
    expect(renameVideo).not.toHaveBeenCalled();
    expect(result.current.items[0]?.displayName).toBe('Enquanto sobe');

    await act(async () => {
      finish({ id: 'v9' });
    });

    await waitFor(() =>
      expect(renameVideo).toHaveBeenCalledWith('v9', 'Enquanto sobe', expect.anything()),
    );
  });

  it('does not try to rename an upload that failed', async () => {
    uploadWithProgress.mockRejectedValue(new Error('Falha no envio.'));
    const { result } = renderHook(() => useUploadQueue());

    act(() => result.current.enqueue([file()]));
    await waitFor(() => expect(result.current.items[0]?.state).toBe('error'));

    await act(async () => {
      await result.current.rename(result.current.items[0]!.id, 'Nome');
    });

    expect(renameVideo).not.toHaveBeenCalled();
  });

  it('names each file of a batch independently', async () => {
    uploadWithProgress.mockImplementation((options: { file: File }) =>
      Promise.resolve({ id: `id-${options.file.name}` }),
    );
    const { result } = renderHook(() => useUploadQueue());

    act(() => result.current.enqueue([file('a.mp4'), file('b.mp4')]));
    await waitFor(() => expect(result.current.items.every((i) => i.state === 'done')).toBe(true));

    const first = result.current.items.find((i) => i.file.name === 'a.mp4')!;
    await act(async () => {
      await result.current.rename(first.id, 'Só o primeiro');
    });

    expect(result.current.items.find((i) => i.file.name === 'a.mp4')?.displayName).toBe(
      'Só o primeiro',
    );
    expect(result.current.items.find((i) => i.file.name === 'b.mp4')?.displayName).toBe('b.mp4');
  });
});
