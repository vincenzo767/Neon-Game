import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: true },
  preview: { open: false },
  build: { target: 'es2022', sourcemap: true },
});
