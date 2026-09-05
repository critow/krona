import { describe, expect, it } from 'vitest'
import { createDefaultLabels, resolveLabels } from './labels'

describe('createDefaultLabels', () => {
  it('formats counts in the locale it was given', () => {
    expect(createDefaultLabels('de-DE').foldedItems(1234)).toBe('1.234 items')
  })

  it('falls back to the default locale rather than throwing on a malformed tag', () => {
    // `new Intl.NumberFormat('en_US')` throws, and this runs while a viewer is
    // rendering: a host that read its locale out of a URL would be left with a
    // blank region instead of a viewer.
    for (const locale of ['x', 'en_US', '!', '']) {
      expect(() => createDefaultLabels(locale), locale).not.toThrow()
    }
    expect(createDefaultLabels('en_US').foldedItems(2)).toBe('2 items')
    expect(resolveLabels(undefined, 'not a locale').foldedLines(1)).toBe('1 line')
  })
})
