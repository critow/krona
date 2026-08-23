import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Alias the workspace packages to source so the playground hot-reloads library edits
// without a build step.
export default defineConfig({
  base: process.env.KRONA_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^krona$/,
        replacement: new URL('../packages/react/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^krona\/(.*)$/,
        replacement: new URL('../packages/react/src/', import.meta.url).pathname + '$1',
      },
      {
        find: /^@krona\/core$/,
        replacement: new URL('../packages/core/src/index.ts', import.meta.url).pathname,
      },
      {
        find: /^@krona\/core\/(.*)$/,
        replacement: new URL('../packages/core/src/formats/', import.meta.url).pathname + '$1.ts',
      },
    ],
  },
})
