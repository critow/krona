import { afterEach, describe, expect, it } from 'vitest'
import { defineKrona, type KronaDiffElement, type KronaFoldDetail } from './index'

defineKrona()

const BEFORE = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

const AFTER = BEFORE.replace('8080', '9090')

const mounted: HTMLElement[] = []

afterEach(() => {
  for (const node of mounted.splice(0)) node.remove()
})

function mount(
  attributes: Record<string, string> = {},
  left = BEFORE,
  right = AFTER,
): KronaDiffElement {
  const element = document.createElement('krona-diff') as KronaDiffElement
  // The narrow layout is off unless a test asks for it. The browser these run
  // in is itself narrower than the 640px default, so leaving it on would make
  // every test about the split view a test about the unified one.
  const attrs = { 'narrow-width': '0', ...attributes }
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
  element.style.height = '320px'
  document.body.append(element)
  mounted.push(element)
  element.left = left
  element.right = right
  return element
}

const shadow = (element: KronaDiffElement) => element.shadowRoot as ShadowRoot
const panel = (element: KronaDiffElement, side: 'left' | 'right') =>
  shadow(element).querySelector(`.krona-panel--${side}`) as HTMLElement
/**
 * Whether a panel is on screen.
 *
 * Its presence in the DOM, not a `hidden` property: `.krona-panel` sets
 * `display: flex`, which outranks the UA rule for `hidden`, so a panel marked
 * hidden would still be visible — and an assertion about the property would
 * only read back what the element had just been told.
 */
const showing = (element: KronaDiffElement, side: 'left' | 'right' | 'unified') =>
  shadow(element).querySelector(`.krona-panel--${side}`) !== null
// Empty rather than throwing when the panel is not on screen at all, which is
// the normal state of one of them on a narrow layout.
const rows = (element: KronaDiffElement, side: 'left' | 'right') => [
  ...(shadow(element).querySelectorAll(`.krona-panel--${side} .krona-lines .krona-row`) ?? []),
]
const text = (element: KronaDiffElement) =>
  shadow(element).querySelector('.krona')?.textContent ?? ''

/** Waits for the first paint, whichever panels the layout decided to show. */
async function ready(element: KronaDiffElement): Promise<KronaDiffElement> {
  await expect
    .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
    .toBeGreaterThan(0)
  return element
}

describe('<krona-diff>', () => {
  it('shows both versions, row for row', async () => {
    const element = await ready(mount({ format: 'json' }))
    // One row list, painted twice: the panels cannot come out of step.
    expect(rows(element, 'left').length).toBe(rows(element, 'right').length)
    expect(rows(element, 'left').length).toBe(8)
  })

  it('marks the changed line on both sides, and only that line', async () => {
    const element = await ready(mount({ format: 'json' }))
    const changed = (side: 'left' | 'right') =>
      rows(element, side)
        .filter((row) => row.classList.contains('krona-row--changed'))
        .map((row) => (row as HTMLElement).dataset.line)
    expect(changed('left')).toEqual(['5'])
    expect(changed('right')).toEqual(['5'])
  })

  it('highlights the words that actually differ', async () => {
    const element = await ready(mount({ format: 'json' }))
    const marked = [...shadow(element).querySelectorAll('.krona-intraline')].map(
      (node) => node.textContent,
    )
    // Not the whole line: only the port number changed.
    expect(marked).toEqual(['8080', '9090'])
  })

  it('lines an added line up against a blank', async () => {
    const element = await ready(
      mount({ format: 'json' }, '{\n  "a": 1\n}', '{\n  "a": 1,\n  "b": 2\n}'),
    )
    const spacers = (side: 'left' | 'right') =>
      rows(element, side).filter((row) => row.classList.contains('krona-row--spacer')).length
    // The left version is a line shorter, so it gets the blank half.
    expect(spacers('left')).toBe(1)
    expect(spacers('right')).toBe(0)
    expect(rows(element, 'left').length).toBe(rows(element, 'right').length)
  })

  it('counts what changed in the toolbar', async () => {
    const element = await ready(mount({ format: 'json' }))
    const toolbar = shadow(element).querySelector('.krona-toolbar') as HTMLElement
    expect(toolbar.hidden).toBe(false)
    expect(toolbar.textContent).toContain('Added: 1')
    expect(toolbar.textContent).toContain('Removed: 1')
  })

  it('hides the toolbar when it is not wanted', async () => {
    const element = await ready(mount({ format: 'json', 'show-toolbar': 'false' }))
    expect((shadow(element).querySelector('.krona-toolbar') as HTMLElement).hidden).toBe(true)
  })

  it('folds a block in both panels at once', async () => {
    const element = await ready(mount({ format: 'json' }))
    const events: KronaFoldDetail[] = []
    element.addEventListener('krona-fold', (event) => {
      events.push((event as CustomEvent<KronaFoldDetail>).detail)
    })

    const server = panel(element, 'left').querySelectorAll<HTMLButtonElement>(
      '.krona-fold-toggle',
    )[1]
    server?.click()

    await expect.poll(() => rows(element, 'left').length).toBe(5)
    // The right panel hid the same rows, unasked: a fold is a row, not a line.
    expect(rows(element, 'right').length).toBe(5)
    expect(text(element)).not.toContain('localhost')
    expect(events).toEqual([{ line: 3, folded: true }])
  })

  it('expands and collapses everything on demand', async () => {
    const element = await ready(mount({ format: 'json' }))
    element.collapseAll()
    await expect.poll(() => rows(element, 'left').length).toBe(1)
    expect(rows(element, 'right').length).toBe(1)

    element.expandAll()
    await expect.poll(() => rows(element, 'left').length).toBe(8)
  })

  it('hides a long unchanged run behind a bar, in both panels', async () => {
    const filler = Array.from({ length: 40 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const element = await ready(
      mount(
        { format: 'json', 'collapse-unchanged': '' },
        `{\n  "head": 1,\n${filler}\n  "tail": 1\n}`,
        `{\n  "head": 2,\n${filler}\n  "tail": 1\n}`,
      ),
    )
    await expect.poll(() => shadow(element).querySelectorAll('.krona-expand-bar').length).toBe(2)
    expect(rows(element, 'left').length).toBeLessThan(20)

    // Only the left copy is a control; the right one would offer a screen
    // reader the same three buttons twice.
    const bars = [...shadow(element).querySelectorAll('.krona-expand-bar')]
    expect(bars.map((bar) => bar.getAttribute('aria-hidden'))).toEqual([null, 'true'])
  })

  it('opens a hidden run one step at a time, from either end', async () => {
    const filler = Array.from({ length: 80 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const element = await ready(
      mount(
        { format: 'json', 'collapse-unchanged': '', step: '10' },
        `{\n  "head": 1,\n${filler}\n  "tail": 1\n}`,
        `{\n  "head": 2,\n${filler}\n  "tail": 1\n}`,
      ),
    )
    await expect.poll(() => shadow(element).querySelectorAll('.krona-expand-bar').length).toBe(2)
    const start = rows(element, 'left').length

    const up = panel(element, 'left').querySelector<HTMLButtonElement>('.krona-expand-action')
    up?.click()
    await expect.poll(() => rows(element, 'left').length).toBe(start + 10)
    expect(rows(element, 'right').length).toBe(start + 10)
  })

  it('keeps the panels in lockstep when one is scrolled', async () => {
    const filler = Array.from({ length: 200 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const element = await ready(
      mount(
        { format: 'json' },
        `{\n  "head": 1,\n${filler}\n  "tail": 1\n}`,
        `{\n  "head": 2,\n${filler}\n  "tail": 1\n}`,
      ),
    )
    const left = panel(element, 'left').querySelector('.krona-scroll') as HTMLElement
    const right = panel(element, 'right').querySelector('.krona-scroll') as HTMLElement

    left.scrollTop = 400
    await expect.poll(() => right.scrollTop).toBe(400)

    // And the other way, which is the case a one-directional sync passes and a
    // reader notices immediately.
    right.scrollTop = 120
    await expect.poll(() => left.scrollTop).toBe(120)
  })

  it('ignores trailing space when told to', async () => {
    const element = await ready(mount({ format: 'json' }, '{\n  "a": 1\n}', '{\n  "a": 1  \n}'))
    await expect
      .poll(
        () =>
          rows(element, 'left').filter((r) => r.classList.contains('krona-row--changed')).length,
      )
      .toBe(1)

    const forgiving = await ready(
      mount(
        { format: 'json', 'ignore-trailing-whitespace': '' },
        '{\n  "a": 1\n}',
        '{\n  "a": 1  \n}',
      ),
    )
    expect(
      rows(forgiving, 'left').filter((r) => r.classList.contains('krona-row--changed')).length,
    ).toBe(0)
  })

  it('carries the diff markers in the gutter', async () => {
    const element = await ready(mount({ format: 'json' }))
    const markers = [...shadow(element).querySelectorAll('.krona-gutter-marker')].map(
      (node) => node.textContent,
    )
    expect(markers).toEqual(['~', '~'])
  })

  it('switches between the versions where a narrow diff was told to stay split', async () => {
    // Ten characters a panel shows neither version, so a cramped split picks one
    // at a time.
    const element = mount({ format: 'json', 'narrow-width': '640', view: 'split' })
    element.style.width = '400px'
    await ready(element)

    await expect
      .poll(() => shadow(element).querySelector('.krona')?.getAttribute('data-narrow'))
      .toBe('true')
    // The current version by default: a diff is read to find out what a change
    // did.
    await expect.poll(() => showing(element, 'left')).toBe(false)
    expect(showing(element, 'right')).toBe(true)

    const [toLeft] = shadow(element).querySelectorAll<HTMLButtonElement>(
      '.krona-side-switch button',
    )
    expect(toLeft?.textContent).toBe('Previous version')
    toLeft?.click()
    await expect.poll(() => showing(element, 'left')).toBe(true)
    expect(showing(element, 'right')).toBe(false)
    expect(toLeft?.getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps both panels where there is room, and offers no switch', async () => {
    const element = mount({ format: 'json' })
    element.style.width = '900px'
    await ready(element)

    expect(shadow(element).querySelector('.krona')?.getAttribute('data-narrow')).toBe(null)
    expect(showing(element, 'left')).toBe(true)
    expect(showing(element, 'right')).toBe(true)
    expect(shadow(element).querySelector('.krona-side-switch')).toBe(null)
  })

  it('reads both versions down one column when asked', async () => {
    const element = mount({ format: 'json', view: 'unified' })
    const column = () =>
      shadow(element).querySelectorAll('.krona-panel--unified .krona-lines .krona-row')
    await expect.poll(() => column().length).toBeGreaterThan(0)

    // The two panels are gone; there is one column instead.
    expect(showing(element, 'left')).toBe(false)
    expect(showing(element, 'right')).toBe(false)

    // A changed line appears twice — the one that went, then the one that came —
    // and each says what it is on its own, since there is no column beside it.
    const tones = [...column()].map((row) =>
      [...row.classList].find((name) => name.startsWith('krona-row--'))?.slice(11),
    )
    expect(tones.filter((tone) => tone === 'removed')).toHaveLength(1)
    expect(tones.filter((tone) => tone === 'added')).toHaveLength(1)
    expect(tones).not.toContain('changed')
    // Eight rows plus the second half of the changed pair.
    expect(column()).toHaveLength(9)
    expect(text(element)).toContain('8080')
    expect(text(element)).toContain('9090')
  })

  it('unifies where there is no room for two panels, and offers no side switch', async () => {
    const element = mount({ format: 'json', 'narrow-width': '640' })
    element.style.width = '400px'
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-panel--unified .krona-row').length)
      .toBeGreaterThan(0)

    expect(showing(element, 'left')).toBe(false)
    // Nothing to switch between: both versions are on screen already.
    expect(shadow(element).querySelector('.krona-side-switch')).toBe(null)
  })

  it('keeps two panels on a narrow screen when told to split', async () => {
    const element = mount({ format: 'json', 'narrow-width': '640', view: 'split' })
    element.style.width = '400px'
    await ready(element)

    expect(showing(element, 'unified')).toBe(false)
    // One panel at a time, with the switch that makes the other reachable.
    expect(showing(element, 'right')).toBe(true)
    expect(showing(element, 'left')).toBe(false)
    expect(shadow(element).querySelector('.krona-side-switch')).not.toBe(null)
  })

  it('folds from the unified column, hiding the block on both sides of it', async () => {
    const element = mount({ format: 'json', view: 'unified' })
    const column = () =>
      shadow(element).querySelectorAll('.krona-panel--unified .krona-lines .krona-row')
    await expect.poll(() => column().length).toBe(9)

    const server = shadow(element).querySelectorAll<HTMLButtonElement>(
      '.krona-panel--unified .krona-fold-toggle',
    )[1]
    server?.click()
    await expect.poll(() => text(element)).not.toContain('localhost')
  })

  it('reports what it parsed, for a host that wants the numbers', async () => {
    const element = await ready(mount({ format: 'json' }))
    // One line replaced by another is a changed row, not an add and a remove.
    expect(element.aligned?.stats).toMatchObject({ added: 0, removed: 0, changed: 1 })
  })
})
