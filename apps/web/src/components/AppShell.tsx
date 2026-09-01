import { NavLink, Outlet } from 'react-router-dom';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../features/auth/useAuth';

export function AppShell(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">FIAP X</span>
          <span className="brand__sub">Vídeos</span>
        </div>

        <nav className="nav" aria-label="Navegação principal">
          <NavLink to="/" end className="nav__link">
            Biblioteca
          </NavLink>
          <NavLink to="/upload" className="nav__link">
            Enviar vídeo
          </NavLink>
        </nav>

        <div className="sidebar__footer">
          {user && (
            <div className="account">
              <span className="account__name">{user.name}</span>
              <span className="account__email" title={user.email}>
                {user.email}
              </span>
            </div>
          )}
          <div className="sidebar__actions">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
