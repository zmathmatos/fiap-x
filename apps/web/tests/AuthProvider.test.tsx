import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { useAuth, useToken } from '../src/features/auth/useAuth';
import { apiClient } from '../src/lib/api-client';
import { authStorage } from '../src/lib/auth-storage';
import { TEST_USER } from './fixtures';

const USER = TEST_USER;

function Probe(): JSX.Element {
  const { user, token, status, login, register, logout } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.name ?? '-'}</span>
      <span data-testid="token">{token ?? '-'}</span>
      <button onClick={() => void login({ email: 'ana@fiapx.local', password: 'senha' })}>
        entrar
      </button>
      <button onClick={() => void register({ name: 'Ana', email: 'ana@fiapx.local', password: 'senha' })}>
        cadastrar
      </button>
      <button onClick={logout}>sair</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('starts anonymous when there is no stored token', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('token')).toHaveTextContent('-');
  });

  it('starts loading and confirms a stored token against the API', async () => {
    authStorage.write('stored-token');
    const me = vi.spyOn(apiClient, 'me').mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('Ana');
    expect(me).toHaveBeenCalledWith(expect.objectContaining({ token: 'stored-token' }));
  });

  it('drops a stored token the API no longer accepts', async () => {
    authStorage.write('expired-token');
    vi.spyOn(apiClient, 'me').mockRejectedValue(new Error('401'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(authStorage.read()).toBeNull();
  });

  it('persists the session on login', async () => {
    vi.spyOn(apiClient, 'login').mockResolvedValue({ user: USER, token: 'fresh-token' });
    vi.spyOn(apiClient, 'me').mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('token')).toHaveTextContent('fresh-token');
    expect(authStorage.read()).toBe('fresh-token');
  });

  it('persists the session on register', async () => {
    vi.spyOn(apiClient, 'register').mockResolvedValue({ user: USER, token: 'new-token' });
    vi.spyOn(apiClient, 'me').mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'cadastrar' }));

    await waitFor(() => expect(authStorage.read()).toBe('new-token'));
  });

  it('wipes the session on logout', async () => {
    vi.spyOn(apiClient, 'login').mockResolvedValue({ user: USER, token: 'fresh-token' });
    vi.spyOn(apiClient, 'me').mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await userEvent.click(screen.getByRole('button', { name: 'sair' }));

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('user')).toHaveTextContent('-');
    expect(authStorage.read()).toBeNull();
  });
});

describe('useAuth outside the provider', () => {
  it('fails loudly rather than handing back an empty session', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow('useAuth precisa estar dentro de <AuthProvider>.');
  });
});

describe('useToken', () => {
  function TokenProbe(): JSX.Element {
    return <span>{useToken()}</span>;
  }

  it('returns the token of an authenticated session', async () => {
    authStorage.write('stored-token');
    vi.spyOn(apiClient, 'me').mockResolvedValue(USER);

    render(
      <AuthProvider>
        <TokenProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('stored-token')).toBeInTheDocument();
  });

  it('refuses to render an authenticated component without a session', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <AuthProvider>
          <TokenProbe />
        </AuthProvider>,
      ),
    ).toThrow('Componente autenticado renderizado sem sessão.');
  });
});
