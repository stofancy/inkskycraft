import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0, rollupOptions: { input: { game: 'index.html', fx: 'tools/fx.html', anim: 'tools/anim.html' } } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
