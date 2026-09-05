import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const src = (path: string) => new URL(path, import.meta.url).pathname

// Alias the workspace packages to source so the playground hot-reloads library
// edits without a build step. Every format entry point has to be listed: one
// left out resolves to the package's `dist` instead, which is empty on a fresh
// checkout — the demo then builds here and fails in CI.
const version = JSON.parse(
  readFileSync(new URL('../packages/react/package.json', import.meta.url), 'utf8'),
).version

export default defineConfig({
  base: process.env.KRONA_BASE ?? '/',
  define: { __KRONA_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  // Two pages: the React playground, and one with no framework on it at all
  // that shows the custom elements.
  build: {
    rollupOptions: {
      input: {
        index: src('./index.html'),
        element: src('./element.html'),
      },
    },
  },
  resolve: {
    alias: [
      { find: /^kronajs$/, replacement: src('../packages/react/src/index.ts') },
      {
        find: /^kronajs\/(json5|json|yaml|toml|ini|xml|hcl|properties)$/,
        replacement: `${src('../packages/react/src/formats/')}$1.ts`,
      },
      { find: /^@kronajs\/element$/, replacement: src('../packages/element/src/index.ts') },
      {
        find: /^@kronajs\/element\/(json5|json|yaml|toml|ini|xml|hcl|properties)$/,
        replacement: `${src('../packages/element/src/formats/')}$1.ts`,
      },
      { find: /^@kronajs\/core$/, replacement: src('../packages/core/src/index.ts') },
      {
        find: /^@kronajs\/core\/(json5|json|yaml|toml|ini|xml|hcl|properties)$/,
        replacement: `${src('../packages/core/src/formats/')}$1.ts`,
      },
    ],
  },
})
