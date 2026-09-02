import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const src = (path: string) => new URL(path, import.meta.url).pathname

/**
 * Component tests run in a real Chromium, never jsdom: virtualization and
 * synced scrolling depend on layout and scroll, which jsdom does not implement.
 * Set KRONA_CHROMIUM_PATH when Playwright's own download is unavailable.
 */
const executablePath = process.env.KRONA_CHROMIUM_PATH

export default defineConfig({
  resolve: {
    alias: [
      { find: /^kronajs$/, replacement: src('./packages/react/src/index.ts') },
      {
        find: /^kronajs\/(json|yaml|toml|ini)$/,
        replacement: `${src('./packages/react/src/formats/')}$1.ts`,
      },
      { find: /^@kronajs\/core$/, replacement: src('./packages/core/src/index.ts') },
      {
        find: /^@kronajs\/core\/(json|yaml|toml|ini)$/,
        replacement: `${src('./packages/core/src/formats/')}$1.ts`,
      },
    ],
  },
  test: {
    coverage: {
      provider: 'v8',
      // Both projects report into one set of numbers: half this library is
      // exercised from node and half from a real browser, and a per-project
      // figure would call the core's React-side callers uncovered and the
      // React package's core imports uncovered, when between them they are not.
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        // Types erase at build time, so a percentage of them means nothing.
        'packages/*/src/**/types.ts',
        // Files that only re-export. A line that forwards a name is covered by
        // whether the name exists, which the type checker already answers, and
        // counting them drags the figure around for no reason.
        //
        // Note this is the two adapters' format shims, one line each. The core's
        // providers sit under the same path and are the most important code in
        // the repository; they are measured.
        'packages/*/src/index.ts',
        'packages/react/src/formats/*.ts',
        'packages/element/src/formats/*.ts',
        'packages/react/src/labels.ts',
        // Generated: the stylesheet, embedded as a string by build-css.
        'packages/*/src/theme/css.ts',
        '**/*.bench.ts',
      ],
      // A floor, not a target. It is set just under what the suite reports
      // today, so it catches a feature landing untested rather than nagging
      // about a line nobody was ever going to reach.
      thresholds: { statements: 91, branches: 84, functions: 92, lines: 94 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          environment: 'node',
          include: ['packages/core/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'browser',
          // The custom element belongs here too: it is DOM from end to end, and
          // it virtualizes, which needs layout and scrolling that jsdom has not
          // got.
          include: ['packages/react/src/**/*.test.tsx', 'packages/element/src/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright({
              launchOptions: executablePath ? { executablePath } : {},
            }),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
