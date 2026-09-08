import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'fiapx.theme';

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'Automático', light: 'Claro', dark: 'Escuro' };
const ICON: Record<Theme, string> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps): JSX.Element {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = (): void => {
      const resolved = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
      root.setAttribute('data-theme', resolved);
    };

    apply();

    try {
      if (theme === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Preference just will not persist.
    }

    if (theme !== 'system') return;

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', apply);
    return () => media?.removeEventListener('change', apply);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      title={`Tema: ${LABEL[theme]}. Clique para alternar.`}
      className={`w-full flex items-center gap-sm h-10 px-2.5 rounded-full text-body-sm text-secondary hover:bg-surface-container-high transition-colors ${
        collapsed ? 'justify-center' : ''
      }`}
    >
      <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
        {ICON[theme]}
      </span>
      {!collapsed && <span className="whitespace-nowrap">Tema: {LABEL[theme]}</span>}
    </button>
  );
}
