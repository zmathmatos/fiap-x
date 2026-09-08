import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { NAV_ITEMS } from './navigation';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';
import { DURATION, SPRING, staggerDelay } from '../lib/motion';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string } | null;
  onLogout: () => void;
}

export function MobileNav({ open, onClose, user, onLogout }: MobileNavProps): JSX.Element {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
          />

          <motion.nav
            aria-label="Navegação principal"
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface-container-low border-r border-secondary-container flex flex-col py-md shadow-md"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={SPRING.snappy}
          >
            <div className="px-gutter mb-xl flex items-center justify-between">
              <div>
                <Logo className="h-5 w-auto text-primary-container" />
                <span className="block mt-xs text-label-caps uppercase text-secondary">Vídeos</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar menu"
                className="w-9 h-9 grid place-items-center rounded-circle text-secondary hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-xs px-sm">
              {NAV_ITEMS.map((item, index) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 + staggerDelay(index), duration: DURATION.base }}
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-sm px-sm py-3 rounded-4xl text-body-sm border-l-2 transition-colors ${
                        isActive
                          ? 'border-primary text-on-surface font-bold bg-secondary-container'
                          : 'border-transparent text-secondary'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}
            </div>

            <div className="px-sm mt-auto pt-md border-t border-secondary-container">
              {user && (
                <div className="px-sm pb-sm flex flex-col">
                  <span className="text-body-sm font-semibold text-on-surface">{user.name}</span>
                  <span className="text-body-sm text-secondary truncate" title={user.email}>
                    {user.email}
                  </span>
                </div>
              )}
              <ThemeToggle />
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-sm px-sm py-2 rounded-full text-body-sm text-secondary hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  logout
                </span>
                Sair
              </button>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}
