import { useEffect, useState } from 'react';
import { Button } from './Button';

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

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'Automático', light: 'Claro', dark: 'Escuro' };

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;

    // "system" removes the attribute entirely so the prefers-color-scheme media
    // query in tokens.css takes over again.
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }

    try {
      if (theme === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Preference just will not persist.
    }
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(NEXT[theme])}
      title={`Tema: ${LABEL[theme]}. Clique para alternar.`}
    >
      Tema: {LABEL[theme]}
    </Button>
  );
}
