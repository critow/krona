import { afterEach, describe, expect, it } from 'vitest'
import './formats/yaml'
import { defineKrona, type KronaFoldDetail, KronaViewerElement } from './index'

defineKrona()

const DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

const mounted: HTMLElement[] = []

afterEach(() => {
  for (const node of mounted.splice(0)) node.remove()
})

/** Mounts a viewer at a real size, so the virtualizer has a window to fill. */
function mount(attributes: Record<string, string> = {}, source = DOC): KronaViewerElement {
  const element = document.createElement('krona-viewer') as KronaViewerElement
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.style.height = '320px'
  document.body.append(element)
  mounted.push(element)
  element.source = source
  return element
}

const shadow = (element: KronaViewerElement) => element.shadowRoot as ShadowRoot
const rows = (element: KronaViewerElement) => [
  ...shadow(element).querySelectorAll('.krona-lines .krona-row'),
]
/** What the reader sees. The stylesheet lives in the shadow root too, and its
 * text would answer for words that are nowhere on screen. */
const text = (element: KronaViewerElement) =>
  shadow(element).querySelector('.krona')?.textContent ?? ''

/**
 * Waits for the first paint.
 *
 * Every assertion that something is *not* on screen has to wait for this first:
 * an empty viewer contains no word you could name, so without it those
 * assertions pass before the element has drawn anything at all.
 */
async function ready(element: KronaViewerElement): Promise<KronaViewerElement> {
  await expect.poll(() => rows(element).length).toBeGreaterThan(0)
  return element
}

describe('<krona-viewer>', () => {
  it('registers itself and upgrades a tag written in markup', async () => {
    expect(customElements.get('krona-viewer')).toBe(KronaViewerElement)
    const element = mount({ format: 'json' })
    await expect.poll(() => rows(element).length).toBeGreaterThan(0)
  })

  it('renders every line of the document, numbered from one', async () => {
    const element = mount({ format: 'json' })
    await expect.poll(() => rows(element).length).toBe(8)
    expect(rows(element).map((row) => (row as HTMLElement).dataset.line)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ])
  })

  it('paints the tokens the core finds, without building any markup from the file', async () => {
    const element = mount({ format: 'json' })
    await expect.poll(() => rows(element).length).toBeGreaterThan(0)
    const keys = [...shadow(element).querySelectorAll('.krona-token--key')].map(
      (node) => node.textContent,
    )
    expect(keys).toContain('"name"')
    expect(shadow(element).querySelectorAll('.krona-token--number').length).toBeGreaterThan(0)
  })

  it('opens a document that is not the format it was told, without throwing', async () => {
    const element = mount({ format: 'json' }, 'not: json\nat: all\n')
    await expect.poll(() => rows(element).length).toBeGreaterThan(0)
    // A parse that fails is a diagnostic, never an exception: the file still opens.
    expect(text(element)).toContain('not: json')
  })

  it('folds a block from the gutter and reports it', async () => {
    const element = mount({ format: 'json' })
    await expect.poll(() => rows(element).length).toBe(8)

    const events: KronaFoldDetail[] = []
    element.addEventListener('krona-fold', (event) => {
      events.push((event as CustomEvent<KronaFoldDetail>).detail)
    })

    const toggle = shadow(element).querySelector<HTMLButtonElement>('.krona-fold-toggle')
    expect(toggle).not.toBe(null)
    // The outermost block is the document itself; the server object is next.
    const server = [...shadow(element).querySelectorAll<HTMLButtonElement>('.krona-fold-toggle')][1]
    server?.click()

    await expect.poll(() => text(element)).not.toContain('localhost')
    expect(events).toEqual([{ line: 3, folded: true }])
    // What is hidden is said, not merely gone.
    expect(shadow(element).querySelector('.krona-fold-placeholder')?.textContent).toContain('items')
  })

  it('opens a folded block again from its placeholder', async () => {
    // Depth 1 leaves the outermost range open and folds what is inside it, so
    // there is exactly one placeholder and it is the server object's.
    const element = await ready(mount({ format: 'json', 'collapsed-depth': '1' }))
    expect(text(element)).not.toContain('localhost')
    expect(text(element)).toContain('"name"')

    shadow(element).querySelector<HTMLButtonElement>('.krona-fold-placeholder')?.click()
    await expect.poll(() => text(element)).toContain('localhost')
  })

  it('collapses to the asked-for depth on load, and only once', async () => {
    const element = await ready(mount({ format: 'json', 'collapsed-depth': '1' }))
    expect(text(element)).not.toContain('localhost')

    shadow(element).querySelector<HTMLButtonElement>('.krona-fold-placeholder')?.click()
    await expect.poll(() => text(element)).toContain('localhost')

    // Re-rendering for an unrelated reason must not fold the document again
    // under the reader.
    element.setAttribute('theme', 'dark')
    await expect
      .poll(() => shadow(element).querySelector('.krona')?.getAttribute('data-theme'))
      .toBe('dark')
    expect(text(element)).toContain('localhost')
  })

  it('expands and collapses everything on demand', async () => {
    const element = mount({ format: 'json' })
    await expect.poll(() => rows(element).length).toBe(8)

    element.collapseAll()
    await expect.poll(() => text(element)).not.toContain('localhost')
    expect(rows(element).length).toBe(1)

    element.expandAll()
    await expect.poll(() => text(element)).toContain('localhost')
  })

  it('opens everything hiding a line to reveal it, even before the first paint', async () => {
    const element = mount({ format: 'json', 'collapsed-depth': '1' })
    // Deliberately not waiting: a link arriving with the page is the case that
    // has to survive the opening fold state being applied after it.
    element.revealLine(4)
    await expect.poll(() => text(element)).toContain('localhost')
  })

  it('marks the line a link points at, in both columns', async () => {
    const element = mount({ format: 'json', 'selected-line': '2' })
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-row--selected').length)
      // One in the gutter, one in the lines column, so the mark runs the row.
      .toBe(2)
  })

  it('carries the theme and the line height the page asked for', async () => {
    const element = mount({ format: 'json', theme: 'dark', 'line-height': '24' })
    await expect.poll(() => rows(element).length).toBeGreaterThan(0)
    const frame = shadow(element).querySelector<HTMLElement>('.krona')
    expect(frame?.dataset.theme).toBe('dark')
    expect(frame?.style.getPropertyValue('--krona-line-height')).toBe('24px')
    // The virtualizer positions rows at the same pitch CSS paints them at.
    expect(rows(element)[1]?.getAttribute('style')).toContain('translateY(24px)')
  })

  it('carries its own stylesheet into the shadow root', async () => {
    // A shadow root is not reached by the page's CSS, so the element has to
    // bring the stylesheet with it or arrive as unstyled text. The theme
    // variables are declared on `.krona` rather than on `:root`, which is what
    // lets the same file serve both packages.
    const element = mount({ format: 'json', theme: 'light' })
    await ready(element)
    const frame = shadow(element).querySelector('.krona') as HTMLElement
    expect(getComputedStyle(frame).backgroundColor).toBe('rgb(255, 255, 255)')

    const dark = mount({ format: 'json', theme: 'dark' })
    await ready(dark)
    const darkFrame = shadow(dark).querySelector('.krona') as HTMLElement
    expect(getComputedStyle(darkFrame).backgroundColor).toBe('rgb(13, 17, 23)')
  })

  it('takes the strings it is given', async () => {
    const element = mount({ format: 'json', 'collapsed-depth': '1' })
    element.labels = { foldedItems: (count) => `${count} штук`, expandBlock: 'Развернуть' }
    await expect.poll(() => text(element)).toContain('штук')
    expect(shadow(element).querySelector('.krona-fold-placeholder')?.getAttribute('title')).toBe(
      'Развернуть',
    )
  })

  it('says what went wrong, and hides it when asked', async () => {
    // A format nobody registered is a diagnostic, not a crash: the document
    // still opens, as plain text.
    const element = mount({ format: 'nonesuch' }, 'a: 1\nb: 2\n')
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-diagnostic').length)
      .toBeGreaterThan(0)
    expect(text(element)).toContain('a: 1')

    element.setAttribute('show-diagnostics', 'false')
    await expect.poll(() => shadow(element).querySelectorAll('.krona-diagnostic').length).toBe(0)
    expect(text(element)).toContain('a: 1')
  })

  it('shows only the rows near the viewport, however long the file is', async () => {
    const long = `{\n${Array.from({ length: 4000 }, (_, i) => `  "key${i}": ${i},`).join('\n')}\n  "last": 1\n}`
    const element = mount({ format: 'json' }, long)
    await expect.poll(() => rows(element).length).toBeGreaterThan(0)
    // A window plus overscan, not four thousand rows.
    expect(rows(element).length).toBeLessThan(80)
    expect(shadow(element).querySelector<HTMLElement>('.krona-canvas')?.style.height).toBe(
      `${4003 * 20}px`,
    )
  })

  it('reads a second format once its provider is imported', async () => {
    const element = mount({ format: 'yaml' }, 'server:\n  host: localhost\n  port: 8080\n')
    await expect.poll(() => rows(element).length).toBe(3)
    expect(shadow(element).querySelectorAll('.krona-token--key').length).toBeGreaterThan(0)
  })

  it('stops observing the page when it is taken off it', async () => {
    const element = mount({ format: 'json' })
    await expect.poll(() => rows(element).length).toBe(8)
    element.remove()
    // Nothing to assert beyond this not throwing: a listener left behind on a
    // removed element is a leak that only shows up much later.
    expect(element.isConnected).toBe(false)
  })
})

describe('numeric attributes', () => {
  it('declines a number that would render the whole document at once', async () => {
    // `overscan="1e9"` asks the virtualizer for every row there is, which is a
    // frozen tab. An attribute can arrive from markup nobody here wrote.
    const body = Array.from({ length: 4000 }, (_, i) => `  "k${i}": ${i},`).join('\n')
    const element = await ready(
      mount({ format: 'json', overscan: '1e9' }, `{\n${body}\n  "z": 0\n}`),
    )
    expect(rows(element).length).toBeLessThan(1200)
  })

  it('falls back to the default row height for an infinite one', async () => {
    const element = await ready(mount({ format: 'json', 'line-height': 'Infinity' }))
    const frame = shadow(element).querySelector('.krona') as HTMLElement
    expect(frame.style.getPropertyValue('--krona-line-height')).toBe('20px')
  })

  it('holds a row height that is merely large to something a browser can paint', async () => {
    const element = await ready(mount({ format: 'json', 'line-height': '1e9' }))
    const frame = shadow(element).querySelector('.krona') as HTMLElement
    expect(frame.style.getPropertyValue('--krona-line-height')).toBe('1000px')
  })
})

describe('attributes the element watches', () => {
  it('repaints when an attribute it reads is changed after the fact', async () => {
    // `link-lines` is read while a row is painted; an attribute consulted by a
    // repaint but watched by nobody leaves the old answer on screen until
    // something unrelated redraws it.
    const element = await ready(mount({ format: 'json' }))
    expect(shadow(element).querySelector('[aria-label="Link to this line"]')).toBe(null)
    element.setAttribute('link-lines', '')
    await expect
      .poll(() => shadow(element).querySelector('[aria-label="Link to this line"]'))
      .not.toBe(null)
  })
})
