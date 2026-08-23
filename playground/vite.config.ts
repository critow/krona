import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const src = (path: string) => new URL(path, import.meta.url).pathname

// Alias the workspace packages to source so the playground hot-reloads library
// edits without a build step.
export default defineConfig({
  base: process.env.KRONA_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^krona$/, replacement: src('../packages/react/src/index.ts') },
      {
        find: /^krona\/(json|yaml|toml|ini)$/,
        replacement: `${src('../packages/react/src/formats/')}$1.ts`,
      },
      { find: /^@krona\/core$/, replacement: src('../packages/core/src/index.ts') },
      {
        find: /^@krona\/core\/(json|yaml|toml|ini)$/,
        replacement: `${src('../packages/core/src/formats/')}$1.ts`,
      },
    ],
  },
})
