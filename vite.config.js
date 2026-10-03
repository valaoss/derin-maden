import { defineConfig } from 'vite';

// her derlemenin kimliği: oyun kendi kimliğini version.json'daki yayınla karşılaştırır, farklıysa yenilenir
const BUILD = (process.env.GITHUB_SHA || '').slice(0, 7) + Date.now().toString(36);

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [{
    name: 'build-version', apply: 'build',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: BUILD }) }); },
  }],
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
  server: { host: true, port: 8765, strictPort: true },
});
