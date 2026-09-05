import { expect, test } from '@playwright/test'

/**
 * The built pages carry a Content-Security-Policy.
 *
 * The test that matters is not that the header is there but that the policy
 * lets the demo work: a policy blocking the bundle would still show the
 * prerendered markup, and nothing else on the page would notice.
 */
test.describe('content security policy', () => {
  for (const path of ['/', '/element.html']) {
    test(`${path} carries a policy and still folds under it`, async ({ page }) => {
      const refused: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
          refused.push(message.text())
        }
      })
      await page.goto(path)
      await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
      await expect(page.locator('.krona-lines .krona-row').first()).toBeVisible()

      // Folding is script: the prerendered markup on its own cannot do it.
      await page.locator('.krona-fold-toggle[aria-expanded="true"]').first().click()
      await expect(page.locator('.krona-fold-placeholder').first()).toBeVisible()
      expect(refused).toEqual([])
    })
  }
})
