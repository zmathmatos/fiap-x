const TOKEN_KEY = 'fiapx.token';

/**
 * Reads and writes the session token.
 *
 * Every access is guarded: a private window or a browser configured to block site
 * data throws on `localStorage`, and that must not take the whole app down.
 */
export const authStorage = {
  read(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  write(token: string): void {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Session simply will not survive a reload. Not worth interrupting the user.
    }
  },

  clear(): void {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to do.
    }
  },
};
