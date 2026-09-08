import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenameField } from '../src/features/videos/RenameField';

describe('RenameField', () => {
  it('shows the current name until the user asks to edit it', async () => {
    render(<RenameField value="aula-02.mp4" onSave={vi.fn()} />);

    expect(screen.getByText('aula-02.mp4')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /renomear/i }));

    expect(screen.getByRole('textbox')).toHaveValue('aula-02.mp4');
  });

  it('saves the trimmed name on submit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RenameField value="aula-02.mp4" onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: /renomear/i }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), '  Aula 02  {Enter}');

    expect(onSave).toHaveBeenCalledWith('Aula 02');
  });

  it('does not call the server when the name did not change', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RenameField value="aula-02.mp4" onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: /renomear/i }));
    await userEvent.type(screen.getByRole('textbox'), '{Enter}');

    expect(onSave).not.toHaveBeenCalled();
  });

  it('abandons the edit on Escape, keeping the original name', async () => {
    const onSave = vi.fn();
    render(<RenameField value="aula-02.mp4" onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: /renomear/i }));
    await userEvent.type(screen.getByRole('textbox'), 'outro nome{Escape}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('aula-02.mp4')).toBeInTheDocument();
  });

  it('reports a failure instead of pretending the rename worked', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Nome muito longo.'));
    render(<RenameField value="aula-02.mp4" onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: /renomear/i }));
    await userEvent.type(screen.getByRole('textbox'), ' novo{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Nome muito longo.');
  });
});
