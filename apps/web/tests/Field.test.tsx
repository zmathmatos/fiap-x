import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '../src/components/Field';

describe('Field', () => {
  it('ties the label to the input', () => {
    render(<Field label="E-mail" />);

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('forwards input attributes', async () => {
    const change = vi.fn();
    render(<Field label="Senha" type="password" placeholder="mínimo 8" onChange={change} />);

    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('placeholder', 'mínimo 8');

    await userEvent.type(input, 'a');
    expect(change).toHaveBeenCalled();
  });

  it('announces the error and points the input at it', () => {
    render(<Field label="E-mail" error="Informe um e-mail válido." />);

    const input = screen.getByLabelText('E-mail');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent('Informe um e-mail válido.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('shows the hint while the field is valid', () => {
    render(<Field label="Senha" hint="Ao menos 8 caracteres." />);

    const input = screen.getByLabelText('Senha');
    const hint = screen.getByText('Ao menos 8 caracteres.');

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('drops the hint once there is an error, so only one message is read', () => {
    render(<Field label="Senha" hint="Ao menos 8 caracteres." error="Senha muito curta." />);

    expect(screen.queryByText('Ao menos 8 caracteres.')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Senha muito curta.');
  });

  it('leaves aria-describedby out when there is nothing to describe', () => {
    render(<Field label="Nome" />);

    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-describedby');
  });
});
