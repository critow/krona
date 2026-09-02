import {
  buildSegments,
  collapsedToDepth,
  contentColumnsOf,
  type DocumentModel,
  type FoldKind,
  type FoldRange,
  type Format,
  type KronaLabels,
  nestingLevelAt,
  parseDocument,
  resolveLabels,
  visibleLines as visibleLinesOf,
} from '@kronajs/core'
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from '@tanstack/virtual-core'
import { chevron, el } from './dom'
import { KRONA_CSS } from './theme/css'

/** Colour scheme, matching the React package's `theme`. */
export type KronaElementTheme = 'light' | 'dark' | 'auto'

/**
 * Brackets come from the range's kind rather than its summary, so a collapsed
 * block reads the way the format writes it in every format, not just JSON.
 */
const BRACKETS: Record<FoldKind, readonly [string, string] | null> = {
  object: ['{', '}'],
  section: ['{', '}'],
  block: ['{', '}'],
  array: ['[', ']'],
  scalar: null,
}

const asNumber = (value: string | null, fallback: number): number => {
  const parsed = Number(value)
  return value === null || value === '' || Number.isNaN(parsed) ? fallback : parsed
}

/**
 * `<krona-viewer>` — a configuration file as a collapsible, virtualized tree.
 *
 * The same document model, folding, tokenizing and highlighting as the React
 * package, rendered without a framework: it is a custom element, so it works in
 * Vue, Svelte, Angular, Astro, a plain HTML page, or anything else that can
 * write a tag.
 *
 * @example
 * ```html
 * <script type="module">
 *   import { defineKronaViewer } from '@kronajs/element'
 *   import '@kronajs/element/yaml'
 *   defineKronaViewer()
 * </script>
 * <krona-viewer format="yaml" collapsed-depth="2"></krona-viewer>
 * <script>
 *   document.querySelector('krona-viewer').source = yamlText
 * </script>
 * ```
 *
 * The document is set as a property rather than an attribute — a file is not a
 * string a page wants in its markup — though `source` works as an attribute too
 * for short documents.
 *
 * What this element does not do yet, which `kronajs` does: diffing, searching,
 * editing, row actions and the minimap.
 */
export class KronaViewerElement extends HTMLElement {
  static readonly observedAttributes = [
    'source',
    'format',
    'theme',
    'locale',
    'line-height',
    'collapsed-depth',
    'overscan',
    'selected-line',
    'show-diagnostics',
  ]

  #root: ShadowRoot
  #frame: HTMLDivElement
  #section: HTMLElement
  #diagnostics: HTMLDivElement
  #scroll: HTMLDivElement
  #canvas: HTMLDivElement
  #gutter: HTMLDivElement
  #lines: HTMLDivElement
  #strut: HTMLDivElement

  #source = ''
  #model: DocumentModel | null = null
  #collapsed = new Set<number>()
  /** Line indices on screen, in order — the rows the virtualizer counts. */
  #visible: number[] = []
  #labels: Partial<KronaLabels> | null = null
  #resolved: KronaLabels
  /** Set until the first render, so an opening depth is applied exactly once. */
  #needsDefaultFold = true
  #virtualizer: Virtualizer<HTMLDivElement, Element> | null = null
  #unmount: (() => void) | null = null
  #frameHandle = 0

  constructor() {
    super()
    this.#resolved = resolveLabels(undefined, undefined)

    this.#root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    // The host is not styled by the sheet — it knows nothing of a shadow root —
    // so the two rules it needs are stated here.
    style.textContent = `:host { display: block; min-height: 0 }\n:host([hidden]) { display: none }\n${KRONA_CSS}`
    this.#root.append(style)

    this.#strut = el('div', 'krona-width-strut')
    this.#strut.setAttribute('aria-hidden', 'true')
    this.#gutter = el('div', 'krona-column krona-gutter')
    this.#lines = el('div', 'krona-column krona-column--lines krona-lines')
    this.#lines.setAttribute('role', 'tree')
    this.#lines.append(this.#strut)
    this.#canvas = el('div', 'krona-canvas', [this.#gutter, this.#lines])
    this.#scroll = el('div', 'krona-scroll', [this.#canvas])
    this.#diagnostics = el('div', 'krona-diagnostics')
    this.#section = el('section', 'krona-viewer', [this.#diagnostics, this.#scroll])
    this.#frame = el('div', 'krona', [this.#section])
    this.#root.append(this.#frame)
  }

  /** The file to show. A property, because a document is not markup. */
  get source(): string {
    return this.#source
  }

  set source(value: string) {
    if (value === this.#source) return
    this.#source = value
    this.#model = null
    this.#needsDefaultFold = true
    this.#schedule()
  }

  /** The parsed document currently on screen, or null before the first render. */
  get model(): DocumentModel | null {
    return this.#model
  }

  /** Overrides for the built-in English strings. */
  get labels(): Partial<KronaLabels> | null {
    return this.#labels
  }

  set labels(value: Partial<KronaLabels> | null) {
    this.#labels = value
    this.#schedule()
  }

  connectedCallback(): void {
    if (this.#virtualizer) return
    const virtualizer = new Virtualizer<HTMLDivElement, Element>({
      count: 0,
      getScrollElement: () => this.#scroll,
      estimateSize: () => this.#lineHeight,
      overscan: this.#overscan,
      scrollToFn: elementScroll,
      observeElementRect,
      observeElementOffset,
      onChange: () => this.#paint(),
    })
    this.#virtualizer = virtualizer
    this.#unmount = virtualizer._didMount()
    this.#schedule()
  }

  disconnectedCallback(): void {
    this.#unmount?.()
    this.#unmount = null
    this.#virtualizer = null
    if (this.#frameHandle) cancelAnimationFrame(this.#frameHandle)
    this.#frameHandle = 0
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
    if (previous === value) return
    if (name === 'source') {
      this.source = value ?? ''
      return
    }
    // Anything else changes how the same document is shown, not what it is.
    if (name === 'format') this.#model = null
    if (name === 'collapsed-depth') this.#needsDefaultFold = true
    this.#schedule()
  }

  /** Opens every folding range. */
  expandAll(): void {
    if (this.#collapsed.size === 0) return
    this.#collapsed = new Set()
    this.#schedule()
  }

  /** Closes every folding range. */
  collapseAll(): void {
    const model = this.#parsed()
    this.#collapsed = new Set(model.foldingRanges.map((range) => range.startLine))
    this.#schedule()
  }

  /**
   * Opens whatever hides a line and scrolls to it. Lines count from 1, the way
   * the gutter counts them and the way `#L42` means the forty-second line.
   */
  revealLine(line: number): void {
    const lineIndex = line - 1
    if (lineIndex < 0) return
    const model = this.#parsed()
    for (const range of model.foldingRanges) {
      if (range.startLine > lineIndex) break
      if (range.endLine >= lineIndex) this.#collapsed.delete(range.startLine)
    }
    this.#render()
    const row = this.#visible.indexOf(lineIndex)
    if (row >= 0) this.#virtualizer?.scrollToIndex(row, { align: 'center' })
  }

  get #lineHeight(): number {
    return Math.max(1, asNumber(this.getAttribute('line-height'), 20))
  }

  get #overscan(): number {
    return Math.max(0, asNumber(this.getAttribute('overscan'), 8))
  }

  get #selectedLine(): number | null {
    const line = asNumber(this.getAttribute('selected-line'), 0)
    return line > 0 ? line - 1 : null
  }

  /**
   * The current model, with the opening fold state applied.
   *
   * The default depth is applied here rather than in the render, because
   * anything that asks for the model may also act on what is folded — and a
   * reveal that ran before the first paint would otherwise be undone by the
   * default arriving after it.
   */
  #parsed(): DocumentModel {
    if (!this.#model) {
      const format = (this.getAttribute('format') ?? 'auto') as Format
      this.#model = parseDocument(this.#source, format)
    }
    if (this.#needsDefaultFold) {
      this.#needsDefaultFold = false
      const depth = this.getAttribute('collapsed-depth')
      this.#collapsed =
        depth === null ? new Set() : collapsedToDepth(this.#model, Math.max(0, asNumber(depth, 0)))
    }
    return this.#model
  }

  /** Coalesces the several attribute changes one assignment can cause. */
  #schedule(): void {
    if (!this.isConnected || this.#frameHandle) return
    this.#frameHandle = requestAnimationFrame(() => {
      this.#frameHandle = 0
      this.#render()
    })
  }

  #render(): void {
    const virtualizer = this.#virtualizer
    if (!virtualizer) return
    const model = this.#parsed()

    this.#resolved = resolveLabels(
      this.#labels ?? undefined,
      this.getAttribute('locale') ?? undefined,
    )
    this.#visible = [...visibleLinesOf(model, this.#collapsed)]

    const theme = (this.getAttribute('theme') ?? 'auto') as KronaElementTheme
    this.#frame.dataset.theme = theme
    this.#frame.style.setProperty('--krona-line-height', `${this.#lineHeight}px`)
    this.#section.setAttribute('aria-label', this.#resolved.document)
    this.#lines.setAttribute('aria-label', this.#resolved.document)
    this.#strut.style.width = `${contentColumnsOf(model)}ch`

    this.#paintDiagnostics(model)

    virtualizer.setOptions({
      ...virtualizer.options,
      count: this.#visible.length,
      overscan: this.#overscan,
      estimateSize: () => this.#lineHeight,
    })
    // What a framework adapter does on every render: it is the call that binds
    // the scroll element and starts the observers, and without it the
    // virtualizer knows the document's height but never which rows are on
    // screen.
    virtualizer._willUpdate()
    virtualizer.measure()
    this.#paint()
  }

  #paintDiagnostics(model: DocumentModel): void {
    const show = this.getAttribute('show-diagnostics') !== 'false'
    this.#diagnostics.replaceChildren()
    const diagnostics = show ? model.diagnostics : []
    this.#diagnostics.hidden = diagnostics.length === 0
    if (diagnostics.length === 0) return
    this.#diagnostics.setAttribute('role', 'status')
    for (const diagnostic of diagnostics) {
      this.#diagnostics.append(
        el('p', `krona-diagnostic krona-diagnostic--${diagnostic.severity}`, diagnostic.message),
      )
    }
  }

  /** Rebuilds the rows inside the scrolled window, and nothing outside it. */
  #paint(): void {
    const virtualizer = this.#virtualizer
    if (!virtualizer) return
    const model = this.#parsed()
    const total = virtualizer.getTotalSize()
    this.#canvas.style.height = `${total}px`
    this.#gutter.style.height = `${total}px`
    this.#lines.style.height = `${total}px`

    const digits = Math.max(2, String(model.lines.length).length)
    const gutterRows: HTMLElement[] = []
    const lineRows: HTMLElement[] = [this.#strut]
    const items = virtualizer.getVirtualItems()

    for (const item of items) {
      const lineIndex = this.#visible[item.index]
      if (lineIndex === undefined) continue
      const range = model.foldAt(lineIndex)
      const folded = range ? this.#collapsed.has(range.startLine) : false
      gutterRows.push(this.#gutterRow(lineIndex, item.start, digits, range, folded))
      lineRows.push(
        this.#lineRow(model, lineIndex, item.index, item.start, range, folded, items.length),
      )
    }

    this.#gutter.replaceChildren(...gutterRows)
    this.#lines.replaceChildren(...lineRows)
  }

  #gutterRow(
    lineIndex: number,
    offset: number,
    digits: number,
    range: FoldRange | undefined,
    folded: boolean,
  ): HTMLElement {
    const number = el('span', 'krona-gutter-number', String(lineIndex + 1))
    number.style.minWidth = `${digits}ch`
    const picked = lineIndex === this.#selectedLine ? ' krona-row--selected' : ''

    // A foldable line makes its whole gutter cell the control: a 16px chevron
    // between a number and the code reads as punctuation, not as a target.
    const row = range
      ? el('button', `krona-row krona-row--normal${picked} krona-fold-toggle`, [number, chevron()])
      : el('div', `krona-row krona-row--normal${picked}`, [number, el('span', 'krona-fold-spacer')])
    row.style.transform = `translateY(${offset}px)`
    if (range && row instanceof HTMLButtonElement) {
      const name = folded ? this.#resolved.expandBlock : this.#resolved.collapseBlock
      row.type = 'button'
      row.tabIndex = -1
      row.setAttribute('aria-expanded', folded ? 'false' : 'true')
      row.setAttribute('aria-label', name)
      row.title = name
      row.addEventListener('click', () => this.#toggleFold(range.startLine))
    }
    return row
  }

  #lineRow(
    model: DocumentModel,
    lineIndex: number,
    index: number,
    offset: number,
    range: FoldRange | undefined,
    folded: boolean,
    setSize: number,
  ): HTMLElement {
    const text = model.lines[lineIndex]?.text ?? ''
    const picked = lineIndex === this.#selectedLine ? ' krona-row--selected' : ''
    const row = el(
      'div',
      `krona-row krona-row--normal${picked}`,
      this.#segments(model, lineIndex, text),
    )
    row.style.transform = `translateY(${offset}px)`
    row.dataset.line = String(lineIndex + 1)
    row.dataset.index = String(index)
    row.setAttribute('role', 'treeitem')
    row.tabIndex = -1
    row.setAttribute('aria-level', String(nestingLevelAt(model, lineIndex)))
    row.setAttribute('aria-posinset', String(index + 1))
    row.setAttribute('aria-setsize', String(setSize))
    if (range) row.setAttribute('aria-expanded', folded ? 'false' : 'true')
    if (folded && range) row.append(this.#placeholder(range))
    return row
  }

  /** One line's text, cut into token, unsafe-character and plain runs. */
  #segments(model: DocumentModel, lineIndex: number, text: string): Node[] {
    const segments = buildSegments(text, model.tokensAt(lineIndex), undefined, false)
    if (segments.length === 0) return [document.createTextNode(text)]
    return segments.map((segment) => {
      if (segment.unsafe) {
        // Rendering the character itself would let bidi controls reorder the
        // line and zero-width ones vanish, making the view lie about the file.
        const marker = el('span', 'krona-unsafe', segment.unsafe.label)
        marker.title = this.#resolved.unsafeCharacter(segment.unsafe.label)
        return marker
      }
      const value = text.slice(segment.start, segment.end)
      if (!segment.token) return document.createTextNode(value)
      return el('span', `krona-token--${segment.token}`, value)
    })
  }

  #placeholder(range: FoldRange): HTMLElement {
    const hidden = range.endLine - range.startLine
    const inside =
      range.childCount === undefined
        ? this.#resolved.foldedLines(hidden)
        : this.#resolved.foldedItems(range.childCount)
    const brackets = BRACKETS[range.kind]
    const button = el(
      'button',
      'krona-fold-placeholder',
      brackets ? `${brackets[0]} ${inside} ${brackets[1]}` : inside,
    )
    button.type = 'button'
    button.title = this.#resolved.expandBlock
    button.addEventListener('click', () => this.#toggleFold(range.startLine))
    return button
  }

  #toggleFold(startLine: number): void {
    const folded = this.#collapsed.has(startLine)
    if (folded) this.#collapsed.delete(startLine)
    else this.#collapsed.add(startLine)
    this.#render()
    this.dispatchEvent(
      new CustomEvent('krona-fold', {
        bubbles: true,
        composed: true,
        detail: { line: startLine + 1, folded: !folded },
      }),
    )
  }
}

/** What `krona-fold` carries: the line the block starts on, and its new state. */
export interface KronaFoldDetail {
  readonly line: number
  readonly folded: boolean
}

/**
 * Registers `<krona-viewer>`, once.
 *
 * Registering a name that is already taken throws, and a page that imports two
 * copies of this package would do exactly that — so the second call is a no-op
 * rather than an error.
 */
export function defineKronaViewer(name = 'krona-viewer'): void {
  if (customElements.get(name)) return
  customElements.define(name, KronaViewerElement)
}
