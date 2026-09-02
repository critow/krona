import { afterEach, describe, expect, it } from 'vitest'
import { defineKrona, type KronaViewerElement } from './index'

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
  ...shadow(element).querySelectorAll<HTMLElement>('.krona-lines .krona-row'),
]

/** The row that has focus, by the line it shows. */
const focusedLine = (element: KronaViewerElement) =>
  (shadow(element).activeElement as HTMLElement | null)?.dataset.line

async function ready(element: KronaViewerElement): Promise<KronaViewerElement> {
  await expect.poll(() => rows(element).length).toBeGreaterThan(0)
  return element
}

/** Presses a key on whatever currently has focus inside the shadow root. */
function press(element: KronaViewerElement, key: string): void {
  const target = (shadow(element).activeElement ?? rows(element)[0]) as HTMLElement
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
}

describe('walking the document with the keyboard', () => {
  it('makes exactly one row tabbable, so Tab enters the tree once', async () => {
    const element = await ready(mount({ format: 'json' }))
    const tabbable = rows(element).filter((row) => row.tabIndex === 0)
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]?.dataset.line).toBe('1')
  })

  it('moves down and up with the arrows', async () => {
    const element = await ready(mount({ format: 'json' }))
    rows(element)[0]?.focus()
    expect(focusedLine(element)).toBe('1')

    press(element, 'ArrowDown')
    await expect.poll(() => focusedLine(element)).toBe('2')
    press(element, 'ArrowDown')
    await expect.poll(() => focusedLine(element)).toBe('3')
    press(element, 'ArrowUp')
    await expect.poll(() => focusedLine(element)).toBe('2')
  })

  it('jumps to the ends with Home and End', async () => {
    const element = await ready(mount({ format: 'json' }))
    rows(element)[0]?.focus()

    press(element, 'End')
    await expect.poll(() => focusedLine(element)).toBe('8')
    press(element, 'Home')
    await expect.poll(() => focusedLine(element)).toBe('1')
  })

  it('opens a folded block with the right arrow rather than moving off it', async () => {
    const element = await ready(mount({ format: 'json', 'collapsed-depth': '1' }))
    // Line 3 opens the server block, which loads folded.
    const server = rows(element).find((row) => row.dataset.line === '3')
    server?.focus()
    expect(server?.getAttribute('aria-expanded')).toBe('false')

    press(element, 'ArrowRight')
    await expect.poll(() => shadow(element).textContent).toContain('localhost')
    // Still on the same line: the first press opens, it does not step into.
    expect(focusedLine(element)).toBe('3')

    press(element, 'ArrowRight')
    await expect.poll(() => focusedLine(element)).toBe('4')
  })

  it('closes an open block with the left arrow, then walks out to its parent', async () => {
    const element = await ready(mount({ format: 'json' }))
    const server = rows(element).find((row) => row.dataset.line === '3')
    server?.focus()

    press(element, 'ArrowLeft')
    await expect.poll(() => shadow(element).textContent).not.toContain('localhost')
    expect(focusedLine(element)).toBe('3')

    // Closed already, so the next press leaves for the row that encloses it.
    press(element, 'ArrowLeft')
    await expect.poll(() => focusedLine(element)).toBe('1')
  })

  it('folds and unfolds with Enter on the row itself', async () => {
    const element = await ready(mount({ format: 'json' }))
    rows(element)
      .find((row) => row.dataset.line === '3')
      ?.focus()

    press(element, 'Enter')
    await expect.poll(() => shadow(element).textContent).not.toContain('localhost')
    press(element, 'Enter')
    await expect.poll(() => shadow(element).textContent).toContain('localhost')
  })

  it('states each row is depth in the tree, since the markup is flat', async () => {
    const element = await ready(mount({ format: 'json' }))
    const levels = rows(element).map((row) => row.getAttribute('aria-level'))
    // The line that opens a block sits at its parent's level: a `{` is the
    // child, and the entries inside it are the grandchildren. The same numbers
    // the React package reports, from the same core function.
    expect(levels).toEqual(['1', '2', '2', '3', '3', '3', '2', '2'])
    expect(shadow(element).querySelector('.krona-lines')?.getAttribute('role')).toBe('tree')
    expect(rows(element)[0]?.getAttribute('role')).toBe('treeitem')
  })

  it('does not take focus from the page before a reader asks for it', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    mounted.push(outside)
    outside.focus()

    await ready(mount({ format: 'json' }))
    // A viewer that grabbed the caret on load would move it away from here.
    expect(document.activeElement).toBe(outside)
  })

  it('keeps a tabbable row when the one it pointed at is folded away', async () => {
    const element = await ready(mount({ format: 'json' }))
    rows(element)
      .find((row) => row.dataset.line === '5')
      ?.focus()
    await expect.poll(() => focusedLine(element)).toBe('5')

    // Folding the block takes line 5 with it; the tree must stay reachable.
    element.collapseAll()
    await expect.poll(() => rows(element).length).toBe(1)
    expect(rows(element).filter((row) => row.tabIndex === 0)).toHaveLength(1)
  })
})
