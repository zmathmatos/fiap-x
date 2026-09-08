import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropzone, isAccepted } from '../src/features/upload/Dropzone';

function drop(files: File[]): void {
  // Selected by test id, not by a styling class: the drop surface is a plain div
  // with no implicit role, and a restyle must not break the drag coverage.
  const zone = screen.getByTestId('dropzone');

  fireEvent.drop(zone, {
    dataTransfer: { files, items: [], types: ['Files'] },
  });
}

describe('isAccepted', () => {
  it('accepts the documented container formats regardless of case', () => {
    expect(isAccepted('a.mp4')).toBe(true);
    expect(isAccepted('b.MOV')).toBe(true);
    expect(isAccepted('c.webm')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isAccepted('notes.pdf')).toBe(false);
    expect(isAccepted('noextension')).toBe(false);
    expect(isAccepted('video.mp4.exe')).toBe(false);
  });
});

describe('Dropzone', () => {
  it('forwards accepted files chosen through the file input', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);

    await user.upload(
      screen.getByLabelText('Selecionar arquivos'),
      new File(['x'], 'clip.mp4', { type: 'video/mp4' }),
    );

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]?.[0][0].name).toBe('clip.mp4');
  });

  it('rejects an unsupported file dropped onto the zone', async () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);

    // Drag-and-drop ignores the `accept` attribute, so this validation is the
    // only thing standing between a .pdf and the upload endpoint.
    drop([new File(['x'], 'doc.pdf', { type: 'application/pdf' })]);

    // The alert fades in, so it is attached at opacity 0 for a moment. Waiting
    // for it to become visible keeps the assertion honest without racing it.
    const alert = await screen.findByText(/Formato não suportado: doc\.pdf/);
    await waitFor(() => expect(alert).toBeVisible());
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('keeps the accepted files when a drop mixes valid and invalid ones', async () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);

    drop([
      new File(['x'], 'clip.mp4', { type: 'video/mp4' }),
      new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
    ]);

    // The alert fades in, so it is attached at opacity 0 for a moment. Waiting
    // for it to become visible keeps the assertion honest without racing it.
    const alert = await screen.findByText(/Formato não suportado: doc\.pdf/);
    await waitFor(() => expect(alert).toBeVisible());
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
