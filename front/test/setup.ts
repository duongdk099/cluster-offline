// utils/notes.ts and services/notesService.ts call the Nuxt auto-import
// useRuntimeConfig(); provide it as a global for the plain (non-Nuxt) test env.
(globalThis as unknown as { useRuntimeConfig: () => unknown }).useRuntimeConfig = () => ({
  public: {
    apiUrl: 'https://api.example.com',
    wsUrl: 'wss://api.example.com/ws',
  },
});
