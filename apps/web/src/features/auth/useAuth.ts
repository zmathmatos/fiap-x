import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthProvider';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return context;
}

/** Token for components that are only rendered behind the auth guard. */
export function useToken(): string {
  const { token } = useAuth();
  if (!token) {
    throw new Error('Componente autenticado renderizado sem sessão.');
  }
  return token;
}
