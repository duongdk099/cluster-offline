import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '~/stores/auth';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  document.cookie = 'token=; path=/; max-age=0';
});

describe('auth store', () => {
  it('starts logged out', () => {
    const store = useAuthStore();
    expect(store.token).toBeNull();
    expect(store.ready).toBe(false);
  });

  it('login persists the token to state, localStorage and cookie', () => {
    const store = useAuthStore();
    store.login('jwt-123');

    expect(store.token).toBe('jwt-123');
    expect(store.ready).toBe(true);
    expect(localStorage.getItem('token')).toBe('jwt-123');
    expect(document.cookie).toContain('token=jwt-123');
  });

  it('logout clears the token from state and localStorage', () => {
    const store = useAuthStore();
    store.login('jwt-123');
    store.logout();

    expect(store.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('bootstrap restores a token saved in localStorage', () => {
    localStorage.setItem('token', 'persisted-token');
    const store = useAuthStore();
    store.bootstrap();

    expect(store.token).toBe('persisted-token');
    expect(store.ready).toBe(true);
  });

  it('bootstrap on a clean slate just marks the store ready', () => {
    const store = useAuthStore();
    store.bootstrap();

    expect(store.token).toBeNull();
    expect(store.ready).toBe(true);
  });
});
