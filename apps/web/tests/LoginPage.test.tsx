import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../src/features/auth/LoginPage';
import { renderWithProviders } from './fixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoginPage', () => {
  it('opens on the login tab', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText('Nome')).toBeNull();
  });

  it('asks for a name only when creating an account', async () => {
    renderWithProviders(<LoginPage />);

    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));

    expect(await screen.findByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Mínimo de 8 caracteres.')).toBeInTheDocument();
  });

  it('signs in with the typed credentials', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, { auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), '  ana@fiapx.local  ');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'ana@fiapx.local', password: 'senha-secreta' }),
    );
  });

  it('creates an account with the typed data', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, { auth: { register } });

    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));
    await userEvent.type(await screen.findByLabelText('Nome'), ' Ana ');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        name: 'Ana',
        email: 'ana@fiapx.local',
        password: 'senha-secreta',
      }),
    );
  });

  it('refuses an invalid e-mail before reaching the API', async () => {
    const login = vi.fn();
    renderWithProviders(<LoginPage />, { auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'nao-e-email');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('requires a password to sign in', async () => {
    const login = vi.fn();
    renderWithProviders(<LoginPage />, { auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe sua senha.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('requires a name to create an account', async () => {
    const register = vi.fn();
    renderWithProviders(<LoginPage />, { auth: { register } });

    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a short password on sign-up but not on sign-in', async () => {
    const register = vi.fn();
    const login = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, { auth: { register, login } });

    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));
    await userEvent.type(await screen.findByLabelText('Nome'), 'Ana');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'curta');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText(/ao menos 8 caracteres/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('tab', { name: 'Entrar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalled());
  });

  it('shows the message the API refused with', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Credenciais inválidas.'));
    renderWithProviders(<LoginPage />, { auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas.');
  });

  it('falls back to a generic message when the failure carries none', async () => {
    const login = vi.fn().mockRejectedValue('boom');
    renderWithProviders(<LoginPage />, { auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível continuar.');
  });

  it('clears the errors when the user switches tabs', async () => {
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'nao-e-email');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));

    expect(screen.queryByText('Informe um e-mail válido.')).toBeNull();
  });

  it('blocks a second submit while the first is in flight', async () => {
    let resolve = (): void => undefined;
    const login = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderWithProviders(<LoginPage />, { auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@fiapx.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Entrar/ })).toBeDisabled());

    resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: /Entrar/ })).toBeEnabled());
  });

  it('asks the browser for the right autocomplete on each mode', async () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');

    await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));

    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
  });
});
