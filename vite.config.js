import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
  server: { host: true, port: 8765, strictPort: true },
});
