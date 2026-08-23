import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          environment: 'node',
          include: ['packages/core/src/**/*.test.ts'],
        },
        resolve: {
          alias: {
            '@krona/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
          },
        },
      },
    ],
  },
})
