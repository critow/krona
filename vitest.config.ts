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
          include: ['packages/react/src/**/*.test.tsx'],
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
