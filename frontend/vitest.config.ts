import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests target the pure helpers under app/utils (no Nuxt runtime needed).
export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
