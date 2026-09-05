import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KronaSelectLineDetail } from './base'
import { defineKrona, type KronaDiffElement, type KronaViewerElement } from './index'

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
let written: string[] = []

beforeEach(() => {
  written = []
  // Reading the clipboard back needs a permission the test browser withholds,
  // so what was written is captured on the way out instead.
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text: string) => {
    written.push(text)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const node of mounted.splice(0)) node.remove()
})

function mount<T extends HTMLElement>(tag: string, attributes: Record<string, string>): T {
  const element = document.createElement(tag) as T
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.style.height = '320px'
  document.body.append(element)
  mounted.push(element)
  return element
}

const shadow = (element: HTMLElement) => element.shadowRoot as ShadowRoot
const action = (element: HTMLElement, line: string, name: string) =>
  shadow(element).querySelector<HTMLButtonElement>(`[data-line="${line}"] [aria-label="${name}"]`)
// Per row: every row carries its own actions, and its own live region with
// them. Asking the shadow root at large would answer for the first row.
const said = (element: HTMLElement, line: string) =>
  shadow(element).querySelector(`[data-line="${line}"] .krona-row-actions [role="status"]`)
    ?.textContent

async function viewer(attributes: Record<string, string> = {}): Promise<KronaViewerElement> {
  const element = mount<KronaViewerElement>('krona-viewer', { format: 'json', ...attributes })
  element.source = DOC
  await expect
    .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
    .toBeGreaterThan(0)
  return element
}

describe('what a row offers', () => {
  it('copies the value on the line', async () => {
    const element = await viewer()
    action(element, '5', 'Copy value')?.click()
    await expect.poll(() => written).toEqual(['8080'])
  })

  it('copies the dotted path to the line', async () => {
    const element = await viewer()
    action(element, '5', 'Copy path')?.click()
    await expect.poll(() => written).toEqual(['server.port'])
  })

  it('shows a hidden character in the copy-path tooltip as its code', async () => {
    // Same rule as the rows, and as the React package: a tooltip cannot carry a
    // badge, so the path is flattened with the same labels.
    const element = mount<KronaViewerElement>('krona-viewer', { format: 'json' })
    element.source = `{\n  "user${String.fromCharCode(0x202e)}admin": 1\n}`
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(0)
    const tip = action(element, '2', 'Copy path')?.dataset.tip ?? ''
    expect(tip).toContain('U+202E')
    expect(tip).not.toContain(String.fromCharCode(0x202e))
  })

  it('copies the whole block from the line that opens it', async () => {
    const element = await viewer()
    action(element, '3', 'Copy')?.click()
    await expect.poll(() => written.length).toBe(1)
    expect(written[0]).toContain('"host": "localhost"')
    expect(written[0]).toContain('"port": 8080')
  })

  it('says so when the clipboard took it', async () => {
    const element = await viewer()
    const button = action(element, '5', 'Copy value')
    button?.click()
    await expect.poll(() => said(element, '5')).toBe('Copied')
    expect(button?.className).toBe('krona-action--confirmed')
  })

  it('stays quiet when the clipboard refuses', async () => {
    // Some embeddings refuse outright. A button that claims success anyway is
    // worse than one that says nothing.
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    const element = await viewer()
    const button = action(element, '5', 'Copy value')
    button?.click()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(button?.className).toBe('')
    expect(said(element, '5')).toBe('')
  })

  it('offers nothing to copy where the host turned it off', async () => {
    const element = await viewer({ 'show-actions': 'false' })
    expect(action(element, '5', 'Copy value')).toBe(null)
    expect(shadow(element).querySelector('.krona-row-actions')).toBe(null)
  })

  it('offers a link only where someone is listening', async () => {
    const quiet = await viewer()
    expect(action(quiet, '5', 'Link to this line')).toBe(null)

    const picked: KronaSelectLineDetail[] = []
    const element = await viewer({ 'link-lines': '' })
    element.addEventListener('krona-select-line', (event) => {
      picked.push((event as CustomEvent<KronaSelectLineDetail>).detail)
    })
    action(element, '5', 'Link to this line')?.click()
    // The fifth line, not its index: this is the number a link carries.
    await expect.poll(() => picked).toEqual([{ line: 5 }])
  })
})

describe('what a row of a diff offers', () => {
  async function diff(attributes: Record<string, string> = {}): Promise<KronaDiffElement> {
    const element = mount<KronaDiffElement>('krona-diff', {
      format: 'json',
      'narrow-width': '0',
      ...attributes,
    })
    element.left = DOC
    element.right = DOC.replace('8080', '9090')
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(0)
    return element
  }

  it('names the version a link belongs to', async () => {
    const picked: KronaSelectLineDetail[] = []
    const element = await diff({ 'link-lines': '' })
    element.addEventListener('krona-select-line', (event) => {
      picked.push((event as CustomEvent<KronaSelectLineDetail>).detail)
    })

    shadow(element)
      .querySelector<HTMLButtonElement>(
        '.krona-panel--left [data-line="5"] [aria-label="Link to this line"]',
      )
      ?.click()
    await expect.poll(() => picked).toEqual([{ line: 5, side: 'left' }])

    shadow(element)
      .querySelector<HTMLButtonElement>(
        '.krona-panel--right [data-line="5"] [aria-label="Link to this line"]',
      )
      ?.click()
    await expect
      .poll(() => picked)
      .toEqual([
        { line: 5, side: 'left' },
        { line: 5, side: 'right' },
      ])
  })

  it('copies from the version the row belongs to', async () => {
    const element = await diff()
    shadow(element)
      .querySelector<HTMLButtonElement>(
        '.krona-panel--left [data-line="5"] [aria-label="Copy value"]',
      )
      ?.click()
    await expect.poll(() => written).toEqual(['8080'])

    shadow(element)
      .querySelector<HTMLButtonElement>(
        '.krona-panel--right [data-line="5"] [aria-label="Copy value"]',
      )
      ?.click()
    await expect.poll(() => written).toEqual(['8080', '9090'])
  })
})

describe('the change map', () => {
  async function diff(attributes: Record<string, string>): Promise<KronaDiffElement> {
    const filler = Array.from({ length: 60 }, (_, i) => `  "same${i}": ${i},`).join('\n')
    const element = mount<KronaDiffElement>('krona-diff', {
      format: 'json',
      'narrow-width': '0',
      ...attributes,
    })
    element.left = `{\n  "head": 1,\n${filler}\n  "tail": 1\n}`
    element.right = `{\n  "head": 2,\n${filler}\n  "tail": 2\n}`
    await expect
      .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
      .toBeGreaterThan(0)
    return element
  }

  it('marks each run of changes, and only those', async () => {
    const element = await diff({ 'show-minimap': 'true' })
    const map = shadow(element).querySelector('.krona-minimap') as HTMLElement
    expect(map).not.toBe(null)
    expect(map.getAttribute('aria-label')).toBe('Change map')

    const marks = [...map.querySelectorAll('.krona-minimap-mark')]
    // Two changed lines, far apart, and sixty unchanged ones between them.
    expect(marks).toHaveLength(2)
    expect(marks.every((mark) => mark.classList.contains('krona-minimap-mark--changed'))).toBe(true)
    // Placed by their share of the whole, so the second sits near the bottom.
    expect(Number.parseFloat((marks[1] as HTMLElement).style.top)).toBeGreaterThan(90)
  })

  it('sits between the panels, and only where there are two', async () => {
    const element = await diff({ 'show-minimap': 'true' })
    const children = [...(shadow(element).querySelector('.krona-panels')?.children ?? [])]
    expect(children.map((child) => child.className)).toEqual([
      'krona-panel krona-panel--left',
      'krona-minimap',
      'krona-panel krona-panel--right',
    ])

    const unified = await diff({ 'show-minimap': 'true', view: 'unified' })
    expect(shadow(unified).querySelector('.krona-minimap')).toBe(null)
  })

  it('is absent unless asked for', async () => {
    const element = await diff({})
    expect(shadow(element).querySelector('.krona-minimap')).toBe(null)
  })

  it('scrolls both panels to where it was clicked', async () => {
    const element = await diff({ 'show-minimap': 'true' })
    const map = shadow(element).querySelector('.krona-minimap') as HTMLElement
    const scrolls = () =>
      [...shadow(element).querySelectorAll('.krona-scroll')].map((node) => node.scrollTop)
    expect(scrolls().every((top) => top === 0)).toBe(true)

    const bounds = map.getBoundingClientRect()
    map.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientY: bounds.top + bounds.height * 0.9 }),
    )
    await expect.poll(() => scrolls()[0]).toBeGreaterThan(0)
    // Both, and to the same place: the panels are read across, not down one.
    expect(new Set(scrolls()).size).toBe(1)
  })
})
