// Nuxt 4 configuration — SPA / static mode so the same build runs both
// in the browser (incremental "strangler" migration) and inside the Tauri
// desktop webview (which loads the statically generated files).
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-04',

  // No server-side rendering: Tauri serves static files, and the FastAPI
  // backend stays the single source of truth for data via /api.
  ssr: false,

  devtools: { enabled: true },

  modules: ['@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  app: {
    // Overridable at build time (NUXT_APP_BASE_URL) so FastAPI can mount the
    // generated output under a sub-path, e.g. /app/ during the migration.
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'Odysseus',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // '' => same-origin relative calls (web, served by FastAPI).
      // For the desktop build, set NUXT_PUBLIC_API_BASE=http://127.0.0.1:7000
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
    },
  },

  // Dev-only proxy: Nuxt dev server (:3000) forwards /api to FastAPI (:7000)
  // so the browser and the Tauri dev webview both talk to the live backend
  // same-origin (no CORS needed in development).
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://127.0.0.1:7000',
        changeOrigin: true,
      },
    },
  },

  vite: {
    // Tailwind v4 via its official Vite plugin (CSS-first config in main.css).
    plugins: [tailwindcss()],
    // Tauri expects a fixed port and a clean stderr stream.
    clearScreen: false,
    server: {
      strictPort: true,
    },
  },
})
