import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression stands in for end-to-end tests here: broken panel alignment
 * or drifted highlighting cannot be asserted in words, only compared pixel by
 * pixel. Set KRONA_CHROMIUM_PATH when Playwright's own browser download is
 * unavailable.
 */
const executablePath = process.env.KRONA_CHROMIUM_PATH

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: {
      // Tight on purpose. At 1% this suite silently accepted a whole extra row
      // and a 20px shift of every line below it — the exact class of breakage
      // it exists to catch. Text is sparse, so a moved row changes far fewer
      // pixels than the area it occupies; the budget has to be near zero and
      // still leave room for antialiasing jitter.
      maxDiffPixelRatio: 0.001,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    ...devices['Desktop Chrome'],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter krona-playground exec vite --port 5174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
