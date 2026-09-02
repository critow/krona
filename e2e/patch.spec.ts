import { expect, test } from '@playwright/test'

/**
 * The patch the demo copies.
 *
 * This runs against the built bundle rather than as a unit test on purpose: the
 * shape of the patch is covered in the core, and what is unproven here is that
 * `unifiedPatch` survives the trip through the published `kronajs` re-export
 * and the production build's tree-shaking at all.
 */
test.describe('copy patch', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('writes the diff on screen out as a patch git apply could read', async ({ page }) => {
    await page.goto('/?mode=diff&sample=json&theme=light')
    await page.waitForSelector('.krona-lines .krona-row')

    await page.getByRole('button', { name: 'Copy patch' }).click()
    await expect(page.getByRole('status')).toHaveText('Patch copied')

    const patch = await page.evaluate(() => navigator.clipboard.readText())
    expect(patch.startsWith('--- a/app.json\n+++ b/app.json\n')).toBe(true)
    expect(patch).toMatch(/^@@ -\d+(,\d+)? \+\d+(,\d+)? @@$/m)
    // Removals before additions, which is how one column is read.
    const body = patch
      .split('\n')
      .filter((line) => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
    expect(body.some((line) => line.startsWith('-'))).toBe(true)
    expect(body.some((line) => line.startsWith('+'))).toBe(true)
  })

  test('is not offered where there is nothing to compare', async ({ page }) => {
    await page.goto('/?mode=viewer&sample=json&theme=light')
    await page.waitForSelector('.krona-lines .krona-row')
    await expect(page.getByRole('button', { name: 'Copy patch' })).toHaveCount(0)
  })
})
