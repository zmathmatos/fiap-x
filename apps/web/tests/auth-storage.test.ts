import { afterEach, describe, expect, it, vi } from 'vitest';
import { authStorage } from '../src/lib/auth-storage';

const KEY = 'fiapx.token';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('authStorage', () => {
  it('round-trips the token', () => {
    authStorage.write('token-abc');

    expect(window.localStorage.getItem(KEY)).toBe('token-abc');
    expect(authStorage.read()).toBe('token-abc');
  });

  it('reads null when no session was stored', () => {
    expect(authStorage.read()).toBeNull();
  });

  it('clears the token', () => {
    authStorage.write('token-abc');
    authStorage.clear();

    expect(authStorage.read()).toBeNull();
  });

  it('reads null instead of throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });

    expect(authStorage.read()).toBeNull();
  });

  it('swallows a write that the browser refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => authStorage.write('token-abc')).not.toThrow();
  });

  it('swallows a clear that the browser refuses', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('access denied');
    });

    expect(() => authStorage.clear()).not.toThrow();
  });
});
