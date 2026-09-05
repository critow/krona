import { expect, test } from '@playwright/test'

/**
 * Formatting a pasted document.
 *
 * Krona never reformats a file it is handed — folding is by line and the diff
 * compares lines, so rewriting the text on the way in would show something
 * nobody wrote. A minified config is therefore one row with nothing to fold,
 * which is exactly what a reader pasting one does not expect; the demo offers
 * the format provider's own formatter as a button instead.
 */
test.describe('formatting your own file', () => {
  const MINIFIED = '{"test":"test", "1": {"2": 3}}'
  const TIDY = ['{', '  "test": "test",', '  "1": {', '    "2": 3', '  }', '}'].join('\n')

  test('expands a minified document, and only when asked', async ({ page }) => {
    await page.goto('/?theme=light')
    await page.getByRole('button', { name: 'Your file' }).click()

    const box = page.locator('#own-left')
    await box.fill(MINIFIED)
    await expect(page.locator('.krona-lines .krona-row')).toHaveCount(1)

    await page.getByRole('button', { name: 'Format', exact: true }).click()
    await expect(box).toHaveValue(TIDY)
    // Six lines, and the block on line 3 now has something to fold.
    await expect(page.locator('.krona-lines .krona-row')).toHaveCount(6)
    await expect(page.locator('.krona-fold-toggle').first()).toBeVisible()
  })

  test('leaves a document that is already tidy exactly as it is', async ({ page }) => {
    await page.goto('/?theme=light')
    await page.getByRole('button', { name: 'Your file' }).click()

    const box = page.locator('#own-left')
    await box.fill(TIDY)
    await page.getByRole('button', { name: 'Format', exact: true }).click()
    await expect(box).toHaveValue(TIDY)
  })

  test('offers nothing where the format has no formatter', async ({ page }) => {
    await page.goto('/?theme=light')
    await page.getByRole('button', { name: 'Your file' }).click()

    const box = page.locator('#own-left')
    // INI is read, highlighted and folded, but its provider writes nothing
    // back, and a button that did nothing would be a lie.
    await box.fill('[server]\nhost = localhost\nport = 8080')
    await expect(page.locator('.krona-lines .krona-row').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Format', exact: true })).toBeDisabled()
  })
})
