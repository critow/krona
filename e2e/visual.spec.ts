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

/**
 * A text description of what each row shows, per panel.
 *
 * The pixel comparison is the primary check, but its budget has to leave room
 * for font rasterisation, and a sparse row of text can move without spending
 * it. This fingerprint is immune to rendering entirely: a row that appears,
 * disappears or changes side shows up as a readable diff instead of a pixel
 * count.
 */
async function alignmentFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const describe = (root: Element): string[] =>
      [...root.querySelectorAll('.krona-lines .krona-row')].map((row) => {
        const line = row.getAttribute('data-line')
        const tone = row.className.replace('krona-row', '').replace('krona-row--', '').trim()
        if (row.querySelector('.krona-expand-bar')) return 'bar'
        return `${line ?? 'spacer'}:${tone || 'normal'}`
      })

    const panels = [...document.querySelectorAll('.krona-panel')]
    if (panels.length === 0) {
      return describe(document.querySelector('.krona') as Element).join('\n')
    }
    const [left, right] = panels.map(describe)
    const height = Math.max(left?.length ?? 0, right?.length ?? 0)
    const lines: string[] = []
    for (let i = 0; i < height; i++) {
      lines.push(`${(left?.[i] ?? '—').padEnd(18)} | ${right?.[i] ?? '—'}`)
    }
    return lines.join('\n')
  })
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
      expect(await alignmentFingerprint(page)).toMatchSnapshot(`${view.name}.txt`)
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
    expect(await alignmentFingerprint(page)).toMatchSnapshot('diff-collapsed.txt')
    await expect(page.locator('.krona')).toHaveScreenshot('diff-collapsed.png')

    // The toolbar's own action, not one of the bars: it must clear every run.
    await page.getByRole('toolbar').getByRole('button', { name: 'Expand all' }).click()
    await page.waitForTimeout(150)
    await expect(page.locator('.krona-expand-bar')).toHaveCount(0)
    expect(await alignmentFingerprint(page)).toMatchSnapshot('diff-expanded.txt')
    await expect(page.locator('.krona')).toHaveScreenshot('diff-expanded.png')
  })
})
