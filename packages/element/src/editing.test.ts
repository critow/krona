import { afterEach, describe, expect, it } from 'vitest'
import type { KronaChangeDetail } from './base'
import { defineKrona, type KronaViewerElement } from './index'

defineKrona()

const DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0"',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

const mounted: HTMLElement[] = []
/** Every `krona-change` the element fired, in order, as seen from the page. */
let changes: string[] = []
let listening: ((event: Event) => void) | null = null

afterEach(() => {
  for (const node of mounted.splice(0)) node.remove()
  if (listening) document.removeEventListener('krona-change', listening)
  listening = null
})

async function viewer(attributes: Record<string, string> = {}): Promise<KronaViewerElement> {
  const element = document.createElement('krona-viewer') as KronaViewerElement
  for (const [name, value] of Object.entries({ format: 'json', editable: '', ...attributes })) {
    element.setAttribute(name, value)
  }
  element.style.height = '400px'
  changes = []
  // On the document, not the element: the event has to cross the shadow
  // boundary and keep bubbling for a page to hear it at all.
  listening = (event: Event) => {
    changes.push((event as CustomEvent<KronaChangeDetail>).detail.source)
  }
  document.addEventListener('krona-change', listening)
  document.body.append(element)
  mounted.push(element)
  element.source = DOC
  await expect
    .poll(() => shadow(element).querySelectorAll('.krona-lines .krona-row').length)
    .toBeGreaterThan(0)
  return element
}

const shadow = (element: HTMLElement) => element.shadowRoot as ShadowRoot
const rows = (element: HTMLElement) => shadow(element).querySelectorAll('.krona-lines .krona-row')
const action = (element: HTMLElement, line: number, name: string) =>
  shadow(element).querySelector<HTMLButtonElement>(
    `[data-line="${line}"] [aria-label="${name}"]`,
  ) ?? undefined
const values = (element: HTMLElement) => [
  ...shadow(element).querySelectorAll<HTMLElement>('.krona-value'),
]
const input = (element: HTMLElement) =>
  shadow(element).querySelector<HTMLInputElement>('.krona-editor-input')
const area = (element: HTMLElement) =>
  shadow(element).querySelector<HTMLTextAreaElement>('.krona-editor-area')

/** Opens a value the way a reader does. */
function openValue(element: HTMLElement, text: string): void {
  const button = values(element).find((node) => node.textContent === text)
  expect(button, `no value button for ${text}`).toBeDefined()
  button?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
}

function fill(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  field.value = text
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(field: HTMLElement, key: string, modifiers: { ctrlKey?: boolean } = {}): void {
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }),
  )
}

describe('editing in <krona-viewer>', () => {
  it('offers nothing to edit unless it is asked to', async () => {
    const element = await viewer({ editable: 'false' })
    expect(values(element)).toHaveLength(0)
    for (const name of ['Edit line', 'Edit block', 'Duplicate', 'Delete']) {
      expect(shadow(element).querySelectorAll(`[aria-label="${name}"]`)).toHaveLength(0)
    }
    // The copy actions are not editing, and stay where they were.
    expect(shadow(element).querySelectorAll('[aria-label="Copy value"]').length).toBeGreaterThan(0)
  })

  it('edits one value in place and leaves the rest of the line alone', async () => {
    const element = await viewer()
    openValue(element, '"0.0.0.0"')
    const field = input(element)
    expect(field?.value).toBe('"0.0.0.0"')
    if (!field) return

    fill(field, '"127.0.0.1"')
    press(field, 'Enter')

    const edited = DOC.replace('"0.0.0.0"', '"127.0.0.1"')
    await expect.poll(() => element.source).toBe(edited)
    // The page hears the whole document, once.
    expect(changes).toEqual([edited])
    expect(input(element)).toBe(null)
  })

  it('leaves the document untouched when the editor is cancelled', async () => {
    const element = await viewer()
    openValue(element, '1')
    const field = input(element)
    if (!field) return

    fill(field, '999')
    press(field, 'Escape')

    await expect.poll(() => input(element)).toBe(null)
    expect(element.source).toBe(DOC)
    expect(changes).toEqual([])
  })

  it('edits one line as raw text, committing on Ctrl+Enter', async () => {
    const element = await viewer()
    action(element, 2, 'Edit line')?.click()
    const field = area(element)
    expect(field?.value).toBe('  "name": "krona",')
    if (!field) return

    fill(field, '  "name": "renamed",')
    // A textarea takes Enter for itself: a line break is what it is for.
    press(field, 'Enter')
    expect(element.source).toBe(DOC)

    press(field, 'Enter', { ctrlKey: true })
    await expect.poll(() => element.source).toBe(DOC.replace('"krona"', '"renamed"'))
  })

  it('edits a whole block and reshapes it into the layout the file uses', async () => {
    const element = await viewer()
    action(element, 3, 'Edit block')?.click()
    const field = area(element)
    expect(field?.value).toBe(['  "server": {', '    "host": "0.0.0.0"', '  },'].join('\n'))
    if (!field) return

    fill(field, '  "server": {"host":"127.0.0.1","port":8080},')
    shadow(element).querySelector<HTMLButtonElement>('.krona-editor-save')?.click()

    await expect
      .poll(() => element.source)
      .toBe(
        [
          '{',
          '  "name": "krona",',
          '  "server": {',
          '    "host": "127.0.0.1",',
          '    "port": 8080',
          '  },',
          '  "tail": 1',
          '}',
        ].join('\n'),
      )
  })

  it('opens a folded block before showing it', async () => {
    const element = await viewer({ 'collapsed-depth': '1' })
    // The block is closed, so the lines the editor is about to show are not on
    // screen at all.
    expect(shadow(element).querySelector('[data-line="4"]')).toBe(null)

    action(element, 3, 'Edit block')?.click()

    await expect.poll(() => shadow(element).querySelector('[data-line="4"]')).not.toBe(null)
    expect(area(element)?.value).toBe(['  "server": {', '    "host": "0.0.0.0"', '  },'].join('\n'))
  })

  it('duplicates an entry and opens the copy, since that is how a new one is made', async () => {
    const element = await viewer()
    action(element, 2, 'Duplicate')?.click()

    await expect
      .poll(() => element.source)
      .toBe(
        [
          '{',
          '  "name": "krona",',
          '  "name": "krona",',
          '  "server": {',
          '    "host": "0.0.0.0"',
          '  },',
          '  "tail": 1',
          '}',
        ].join('\n'),
      )
    expect(area(element)?.value).toBe('  "name": "krona",')
  })

  it('removes a whole block, and the comma that would be left dangling', async () => {
    const element = await viewer()
    action(element, 3, 'Delete')?.click()

    await expect
      .poll(() => element.source)
      .toBe(['{', '  "name": "krona",', '  "tail": 1', '}'].join('\n'))
  })

  it('undoes and redoes an edit', async () => {
    const element = await viewer()
    expect(element.canUndo).toBe(false)

    openValue(element, '"krona"')
    const field = input(element)
    if (!field) return
    fill(field, '"renamed"')
    press(field, 'Enter')
    await expect.poll(() => element.canUndo).toBe(true)

    element.undo()
    expect(element.source).toBe(DOC)
    expect(element.canRedo).toBe(true)

    element.redo()
    expect(element.source).toBe(DOC.replace('"krona"', '"renamed"'))
    // Every step is reported, so a page holding the text stays in step.
    expect(changes).toHaveLength(3)
  })

  it('starts a new history when it is handed a new document', async () => {
    const element = await viewer()
    openValue(element, '"krona"')
    const field = input(element)
    if (!field) return
    fill(field, '"renamed"')
    press(field, 'Enter')
    await expect.poll(() => element.canUndo).toBe(true)

    // Undoing into the previous file would put back lines this one never had.
    element.source = '{\n  "other": true\n}'
    expect(element.canUndo).toBe(false)
    element.undo()
    expect(element.source).toBe('{\n  "other": true\n}')
  })

  it('repaints the rows an edit moved', async () => {
    const element = await viewer()
    const before = rows(element).length
    action(element, 3, 'Delete')?.click()
    // Two lines fewer on screen, not just in the text behind it.
    await expect.poll(() => rows(element).length).toBe(before - 3)
  })
})
