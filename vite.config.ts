import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    // three.js is large; isolate it so app code changes don't bust its cache.
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
    chunkSizeWarningLimit: 900,
  },
  // `npm start` runs `vite preview` behind Railway's proxy: it forwards an arbitrary public
  // hostname, which Vite's preview server rejects by default (DNS-rebinding protection).
  preview: { host: true, allowedHosts: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
