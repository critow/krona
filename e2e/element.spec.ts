import { expect, test } from '@playwright/test'

/**
 * The custom elements, on a page with no framework on it.
 *
 * This runs against the built bundle rather than as a unit test because that is
 * the part unit tests cannot reach: the elements are exercised in a real
 * Chromium either way, but only here are they the production build, loaded from
 * a script tag, on a page React never touches.
 */
test.describe('@kronajs/element on a plain page', () => {
  test('renders a foldable viewer and a side-by-side diff', async ({ page }) => {
    const failures: string[] = []
    page.on('pageerror', (error) => failures.push(String(error)))
    await page.goto('/element.html')

    const viewer = page.locator('krona-viewer')
    const diff = page.locator('krona-diff')
    await expect(viewer.locator('.krona-lines .krona-row').first()).toBeVisible()
    await expect(diff.locator('.krona-panel--left .krona-lines .krona-row').first()).toBeVisible()
    expect(failures, 'the page must render without runtime errors').toEqual([])

    // Both panels of the diff show the same number of rows, which is what makes
    // them line up.
    const left = await diff.locator('.krona-panel--left .krona-lines .krona-row').count()
    const right = await diff.locator('.krona-panel--right .krona-lines .krona-row').count()
    expect(left).toBe(right)
    expect(left).toBeGreaterThan(0)
  })

  test('carries its own styles into the shadow root', async ({ page }) => {
    await page.goto('/element.html')
    const frame = page.locator('krona-viewer .krona')
    await expect(frame).toBeVisible()
    // The page's own stylesheet cannot reach inside a shadow root, so a painted
    // background is proof the element brought the sheet with it.
    await expect(frame).toHaveCSS('background-color', 'rgb(13, 17, 23)')
  })

  test('folds a block from the gutter', async ({ page }) => {
    await page.goto('/element.html')
    const viewer = page.locator('krona-viewer')
    await expect(viewer.locator('.krona-lines .krona-row').first()).toBeVisible()
    // The document's full height, not the rendered row count: rows are
    // virtualized, so the window stays just as full whatever is hidden inside
    // the file.
    const canvas = viewer.locator('.krona-canvas').first()
    const heightOf = async () =>
      Number((await canvas.getAttribute('style'))?.match(/height:\s*(\d+)px/)?.[1] ?? 0)
    const before = await heightOf()
    expect(before).toBeGreaterThan(0)

    // The page opens at depth 2, so some blocks are folded already; clicking one
    // of those would expand it and make the document taller instead.
    await viewer.locator('.krona-fold-toggle[aria-expanded="true"]').first().click()
    await expect.poll(heightOf).toBeLessThan(before)
    await expect(viewer.locator('.krona-fold-placeholder').first()).toBeVisible()
  })
})
