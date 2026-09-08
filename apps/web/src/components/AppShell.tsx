import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';
import { Logo } from './Logo';
import { NAV_ITEMS } from './navigation';
import { DURATION, SPRING } from '../lib/motion';
import { useAuth } from '../features/auth/useAuth';

const STORAGE_KEY = 'fiapx.sidebar';

const EXPANDED = 236;
const COLLAPSED = 76;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/**
 * A label that slides away with the rail rather than blinking out.
 *
 * Animating the width, not just the opacity, is what keeps the icons from
 * jumping the moment the panel starts moving.
 */
function Label({ show, children }: { show: boolean; children: ReactNode }): JSX.Element {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          className="block whitespace-nowrap overflow-hidden"
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: DURATION.fast }}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function AppShell(): JSX.Element {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch {
      // The preference just will not survive a reload.
    }
  }, [collapsed]);
  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.end
      ? pathname === item.to || pathname.startsWith('/videos')
      : pathname.startsWith(item.to),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-variant">
      {}
      <motion.aside
        className="relative hidden md:flex shrink-0 flex-col my-md ml-md py-md rounded-4xl bg-surface-container-lowest border border-secondary-container shadow-md"
        animate={{ width: collapsed ? COLLAPSED : EXPANDED }}
        transition={SPRING.snappy}
      >
        {}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-10 z-10 w-6 h-6 grid place-items-center rounded-circle bg-surface-container-lowest border border-secondary-container text-secondary shadow-sm hover:text-primary-container hover:border-primary-container transition-colors"
        >
          <motion.span
            className="material-symbols-outlined text-[16px]"
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={SPRING.snappy}
            aria-hidden="true"
          >
            chevron_left
          </motion.span>
        </button>

        <div
          className={`mb-xl overflow-hidden text-primary-container ${collapsed ? 'px-0 flex justify-center' : 'px-4'}`}
        >
          <h1>
            <Logo
              variant={collapsed ? 'mark' : 'full'}
              className={collapsed ? 'h-6 w-auto' : 'h-6 w-auto'}
            />
          </h1>
          <Label show={!collapsed}>
            <span className="block mt-xs text-label-caps uppercase text-secondary">Vídeos</span>
          </Label>
        </div>

        <nav className="flex-1 flex flex-col gap-xs px-3" aria-label="Navegação principal">
          {NAV_ITEMS.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}

              className={`relative flex items-center gap-sm h-10 px-2.5 rounded-full text-body-sm transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                index === activeIndex
                  ? 'text-on-surface font-bold'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {}
              {index === activeIndex && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-full bg-secondary-container"
                  transition={SPRING.snappy}
                />
              )}
              <span
                className="material-symbols-outlined text-[20px] relative shrink-0"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="relative">
                <Label show={!collapsed}>{item.label}</Label>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 mt-auto pt-md border-t border-secondary-container">
          <AnimatePresence initial={false}>
            {user && !collapsed && (
              <motion.div
                className="px-2.5 pb-sm flex flex-col overflow-hidden"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.fast }}
              >
                <span className="text-body-sm font-semibold text-on-surface truncate">
                  {user.name}
                </span>
                <span className="text-body-sm text-secondary truncate" title={user.email}>
                  {user.email}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <ThemeToggle collapsed={collapsed} />

          <button
            type="button"
            onClick={logout}
            title="Sair"
            className={`w-full flex items-center gap-sm h-10 px-2.5 rounded-full text-body-sm text-secondary hover:bg-surface-container-high transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
              logout
            </span>
            <Label show={!collapsed}>Sair</Label>
          </button>
        </div>
      </motion.aside>

      <MobileNav
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user ?? null}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="md:hidden shrink-0 h-14 px-md flex items-center gap-sm">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            className="w-10 h-10 -ml-2 grid place-items-center rounded-circle text-on-surface active:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              menu
            </span>
          </button>
          <Logo className="h-5 w-auto text-primary-container" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-md sm:px-lg pb-lg pt-0 md:pt-lg">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
