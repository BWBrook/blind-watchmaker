import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        classic: resolve(import.meta.dirname, 'classic/index.html'),
        manual: resolve(import.meta.dirname, 'manual/index.html'),
        teachers: resolve(import.meta.dirname, 'manual/teachers.html'),
      },
    },
  },
});
