import { afterEach, describe, expect, it } from 'vitest'
import { defineKrona, type KronaDiffElement, type KronaViewerElement } from './index'

defineKrona()

const DOC = [
  '{',
  '  "host": "localhost",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "note": "LOCALHOST"',
  '}',
].join('\n')

const AFTER = DOC.replace('8080', '9090')

const mounted: HTMLElement[] = []

afterEach(() => {
  for (const node of mounted.splice(0)) node.remove()
})

function mount<T extends HTMLElement>(tag: string, attributes: Record<string, string>): T {
  const element = document.createElement(tag) as T
  for (const [name, value] of Object.entries({ 'show-search': 'true', ...attributes })) {
    element.setAttribute(name, value)
  }
  element.style.height = '320px'
  document.body.append(element)
  mounted.push(element)
  return element
}

const shadow = (element: HTMLElement) => element.shadowRoot as ShadowRoot
const field = (element: HTMLElement) =>
  shadow(element).querySelector('.krona-search-input') as HTMLInputElement
const count = (element: HTMLElement) =>
  shadow(element).querySelector('.krona-search-count')?.textContent
const matches = (element: HTMLElement) =>
  [...shadow(element).querySelectorAll('.krona-match')].map((node) => node.textContent)
const current = (element: HTMLElement) =>
  shadow(element).querySelector('.krona-match--current')?.textContent ?? null
const steps = (element: HTMLElement) => [
  ...shadow(element).querySelectorAll<HTMLButtonElement>('.krona-search-step'),
]

/** Types into the field the way a reader does, one `input` event and all. */
function type(element: HTMLElement, text: string): void {
  const input = field(element)
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function viewer(attributes: Record<string, string> = {}): Promise<KronaViewerElement> {
  const element = mount<KronaViewerElement>('krona-viewer', { format: 'json', ...attributes })
  element.source = DOC
  await expect
    .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
    .toBeGreaterThan(0)
  return element
}

describe('finding text in <krona-viewer>', () => {
  it('offers the field only where it was asked for', async () => {
    const off = await viewer({ 'show-search': 'false' })
    expect(shadow(off).querySelector('.krona-search')).toBe(null)

    const on = await viewer()
    expect(shadow(on).querySelector('.krona-search')).not.toBe(null)
  })

  it('highlights every occurrence and counts them', async () => {
    const element = await viewer()
    type(element, 'localhost')

    await expect.poll(() => matches(element).length).toBe(3)
    // Case-insensitive by default, so the shouted one counts too.
    expect(matches(element)).toEqual(['localhost', 'localhost', 'LOCALHOST'])
    expect(count(element)).toBe('0 / 3')
  })

  it('walks the matches, marking the one the reader is on, and wraps', async () => {
    const element = await viewer()
    type(element, 'localhost')
    await expect.poll(() => matches(element).length).toBe(3)

    const [, next] = steps(element)
    next?.click()
    await expect.poll(() => current(element)).toBe('localhost')
    expect(count(element)).toBe('1 / 3')

    next?.click()
    next?.click()
    await expect.poll(() => count(element)).toBe('3 / 3')
    expect(current(element)).toBe('LOCALHOST')

    // Wrapping rather than stopping: a search that ends at the last match makes
    // you scroll back to the top yourself.
    next?.click()
    await expect.poll(() => count(element)).toBe('1 / 3')
  })

  it('respects the query case when asked to', async () => {
    const element = await viewer()
    type(element, 'LOCALHOST')
    await expect.poll(() => matches(element).length).toBe(3)

    shadow(element).querySelector<HTMLButtonElement>('.krona-search-toggle')?.click()
    await expect.poll(() => matches(element)).toEqual(['LOCALHOST'])
  })

  it('says when a query finds nothing', async () => {
    const element = await viewer()
    type(element, 'nowhere')
    await expect.poll(() => count(element)).toBe('No matches')
    expect(matches(element)).toEqual([])
    expect(steps(element).every((step) => step.disabled)).toBe(true)
  })

  it('opens a folded block to reach a match inside it', async () => {
    const element = await viewer({ 'collapsed-depth': '1' })
    // The server block is folded, so its lines are not rendered at all.
    expect(shadow(element).textContent).not.toContain('8080')

    type(element, '8080')
    steps(element)[1]?.click()
    await expect.poll(() => shadow(element).textContent).toContain('8080')
    expect(current(element)).toBe('8080')
  })
})

describe('finding text in <krona-diff>', () => {
  async function diff(attributes: Record<string, string> = {}): Promise<KronaDiffElement> {
    const element = mount<KronaDiffElement>('krona-diff', {
      format: 'json',
      'narrow-width': '0',
      ...attributes,
    })
    element.left = DOC
    element.right = AFTER
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(0)
    return element
  }

  it('searches both versions', async () => {
    const element = await diff()
    type(element, '8080')
    // Only the previous version has 8080; the current one has 9090.
    await expect.poll(() => matches(element)).toEqual(['8080'])
    expect(count(element)).toBe('0 / 1')

    type(element, 'port')
    // One per version, painted in both panels.
    await expect.poll(() => matches(element).length).toBe(2)
  })

  it('walks the matches down the screen rather than through one file', async () => {
    const element = await diff()
    type(element, 'port')
    await expect.poll(() => matches(element).length).toBe(2)

    const [, next] = steps(element)
    next?.click()
    // The left panel's comes first, because the two share a row and the old
    // line is read before the one that replaced it.
    await expect.poll(() => current(element)).toBe('port')
    expect(count(element)).toBe('1 / 2')
    next?.click()
    await expect.poll(() => count(element)).toBe('2 / 2')
  })

  it('opens a collapsed run of unchanged rows to reach a match', async () => {
    const filler = Array.from({ length: 40 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const element = mount<KronaDiffElement>('krona-diff', {
      format: 'json',
      'narrow-width': '0',
      'collapse-unchanged': '',
      'show-search': 'true',
    })
    element.left = `{\n  "head": 1,\n${filler}\n  "needle": "here",\n  "tail": 1\n}`
    element.right = `{\n  "head": 2,\n${filler}\n  "needle": "here",\n  "tail": 1\n}`
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-expand-bar').length)
      .toBeGreaterThan(0)
    expect(shadow(element).textContent).not.toContain('needle')

    type(element, 'needle')
    steps(element)[1]?.click()
    await expect.poll(() => shadow(element).textContent).toContain('needle')
    expect(current(element)).toBe('needle')
  })

  it('finds text in the unified column too', async () => {
    const element = await diff({ view: 'unified' })
    type(element, 'localhost')
    // Three of them, not six: the lines carrying them are unchanged, and an
    // unchanged line appears once in a unified column, read from the version
    // the reader still has.
    await expect.poll(() => matches(element).length).toBe(3)

    // A changed line is the one that appears on both sides here, so it is the
    // one whose current marker the column can actually show: an unchanged row
    // is read from the current version, and a hit in the previous one has no
    // row of its own to mark.
    type(element, '8080')
    await expect.poll(() => matches(element)).toEqual(['8080'])
    steps(element)[1]?.click()
    await expect.poll(() => current(element)).toBe('8080')
  })
})
