import { expect, type Page, test } from '@playwright/test'

/**
 * Reference views. Each is a state the layout can break in a way no assertion
 * about the DOM would catch: panel alignment, gutter width, token colours.
 */
const VIEWS = [
  { name: 'viewer-large-json', query: 'mode=viewer&sample=big' },
  { name: 'viewer-yaml-block-scalars', query: 'mode=viewer&sample=yaml' },
  { name: 'viewer-toml-nested-tables', query: 'mode=viewer&sample=toml' },
  { name: 'diff-reordered-keys', query: 'mode=diff&sample=reordered' },
  { name: 'diff-unrelated-files', query: 'mode=diff&sample=unrelated' },
  { name: 'diff-dark-theme', query: 'mode=diff&sample=json&theme=dark' },
] as const

async function settle(page: Page): Promise<void> {
  await page.waitForSelector('.krona-lines .krona-row')
  // Fold chevrons animate; wait them out so the pixels are stable.
  await page.waitForTimeout(250)
  await page.evaluate(() => document.fonts.ready)
}

test.describe('reference views', () => {
  test.use({ viewport: { width: 1400, height: 900 } })

  for (const view of VIEWS) {
    test(view.name, async ({ page }) => {
      const failures: string[] = []
      page.on('pageerror', (error) => failures.push(String(error)))
      await page.goto(`/?${view.query}`)
      await settle(page)
      expect(failures, 'the page must render without runtime errors').toEqual([])
      await expect(page.locator('.krona')).toHaveScreenshot(`${view.name}.png`)
    })
  }
})

test.describe('collapsed unchanged runs', () => {
  test.use({ viewport: { width: 1400, height: 900 } })

  test('are hidden behind a bar, and reappear when expanded', async ({ page }) => {
    await page.goto('/?mode=diff&sample=collapsed')
    await settle(page)
    await expect(page.locator('.krona-expand-bar').first()).toBeVisible()
    await expect(page.locator('.krona')).toHaveScreenshot('diff-collapsed.png')

    // The toolbar's own action, not one of the bars: it must clear every run.
    await page.getByRole('toolbar').getByRole('button', { name: 'Expand all' }).click()
    await page.waitForTimeout(150)
    await expect(page.locator('.krona-expand-bar')).toHaveCount(0)
    await expect(page.locator('.krona')).toHaveScreenshot('diff-expanded.png')
  })
})
