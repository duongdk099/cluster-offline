import wasm from 'vite-plugin-wasm';

export default defineNuxtConfig({
  compatibilityDate: '2025-04-29',
  devtools: { enabled: true },
  ssr: true,
  modules: ['@pinia/nuxt', '@nuxt/eslint', '@nuxtjs/color-mode'],
  css: ['~/assets/css/main.css'],
  components: {
    dirs: [
      {
        path: '~/components',
        pathPrefix: false,
        extensions: ['vue'],
      },
    ],
  },
  postcss: {
    plugins: { '@tailwindcss/postcss': {} },
  },
  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark',
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001',
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
    },
  },
  vite: {
    plugins: [wasm()],
    optimizeDeps: { exclude: ['image-wasm'] },
    server: { fs: { allow: ['..'] } },
  },
  app: {
    head: {
      title: 'NotesAides',
      meta: [
        { name: 'description', content: 'A fast Notes app with Hono, Bun, and Nuxt.' },
        { name: 'color-scheme', content: 'dark light' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  nitro: {
    preset: 'node-server',
  },
  experimental: {
    appManifest: false,
  },
  typescript: { strict: true },
});
