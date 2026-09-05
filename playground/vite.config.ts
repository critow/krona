import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const src = (path: string) => new URL(path, import.meta.url).pathname

// Alias the workspace packages to source so the playground hot-reloads library
// edits without a build step. Every format entry point has to be listed: one
// left out resolves to the package's `dist` instead, which is empty on a fresh
// checkout — the demo then builds here and fails in CI.
const version = JSON.parse(
  readFileSync(new URL('../packages/react/package.json', import.meta.url), 'utf8'),
).version

/**
 * What the demo will and will not load.
 *
 * The page shows files a reader brings, so it says out loud that it fetches
 * nothing, frames nothing and runs no script it did not ship. `style-src` still
 * needs `'unsafe-inline'`: the prerendered HTML carries Krona's stylesheet
 * inline, and React writes each row's position as a `style` attribute.
 *
 * Only in a build. The dev server injects inline scripts of its own, and
 * `frame-ancestors` is ignored in a meta policy anyway — a static host has no
 * header to put it in.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const csp = (): Plugin => ({
  name: 'krona-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
})

export default defineConfig({
  base: process.env.KRONA_BASE ?? '/',
  define: { __KRONA_VERSION__: JSON.stringify(version) },
  plugins: [react(), csp()],
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
