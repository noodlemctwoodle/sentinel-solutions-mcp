import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: ['**/*', '!pre-built-index.json'],  // Clean everything except pre-built index
  sourcemap: true,
  dts: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
