import { defineStore } from 'pinia';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function readCookieToken() {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('token='))
    ?.split('=')[1];
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    ready: false,
  }),
  actions: {
    bootstrap() {
      if (import.meta.server) return;

      const stored = readCookieToken() || localStorage.getItem('token');
      if (stored) {
        this.token = stored;
        document.cookie = `token=${stored}; path=/; max-age=${COOKIE_MAX_AGE}`;
      }
      this.ready = true;
    },
    login(token: string) {
      this.token = token;
      this.ready = true;
      localStorage.setItem('token', token);
      document.cookie = `token=${token}; path=/; max-age=${COOKIE_MAX_AGE}`;
    },
    logout() {
      this.token = null;
      this.ready = true;
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; max-age=0';
    },
  },
});
