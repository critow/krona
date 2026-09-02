import {
  buildSegments,
  type CollapsedRegion,
  type DocumentModel,
  type ExpandDirection,
  type FoldKind,
  type FoldRange,
  type KronaLabels,
  nestingLevelAt,
  type Span,
} from '@kronajs/core'
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from '@tanstack/virtual-core'
import { chevron, el } from './dom'

/** How a row is painted: the diff's four kinds, plus the blank half of a pair. */
export type RowTone = 'normal' | 'added' | 'removed' | 'changed' | 'spacer'

/** One row of one column, as the element that owns it describes it. */
export interface ColumnRow {
  /** Line of this column's document, or null for a spacer or an expand bar. */
  readonly lineIndex: number | null
  readonly tone: RowTone
  /** Index of the hidden run this row stands in for, if it is a bar. */
  readonly expandRegion?: number
  /** Word-level spans to mark inside a changed line. */
  readonly intraline?: readonly Span[]
  /** True when the whole line counts as changed rather than parts of it. */
  readonly wholeLine?: boolean
}

/**
 * Everything a column has to ask its owner.
 *
 * A viewer and a diff panel paint identical rows and differ entirely in what
 * they mean: a viewer folds by line, a panel folds by row so that both sides
 * hide together. Rather than teach the painting code both, the questions it
 * needs answering are collected here and each element answers them its own way.
 */
export interface ColumnHost {
  readonly labels: () => KronaLabels
  readonly lineHeight: () => number
  readonly overscan: () => number
  /** The document this column shows. */
  readonly model: () => DocumentModel
  /** Widest line across every document on screen, so panels reserve one width. */
  readonly contentColumns: () => number
  readonly foldAt: (lineIndex: number) => FoldRange | undefined
  readonly isFolded: (lineIndex: number) => boolean
  readonly toggleFold: (lineIndex: number) => void
  /** Zero-based line the reader followed a link to, if any. */
  readonly selectedLine?: () => number | null
  /** Hidden run behind a bar, when this column shows expand bars. */
  readonly region?: (index: number) => CollapsedRegion | undefined
  readonly expandContext?: (index: number, direction: ExpandDirection) => void
  readonly step?: () => number
  /**
   * False for the right panel of a diff: both panels paint the bar so it reads
   * as one band across the screen, but only one of them is a control, or a
   * screen reader is offered the same three buttons twice.
   */
  readonly barsAreControls?: () => boolean
  /** Diff markers in the gutter. Off in a viewer, where nothing changed. */
  readonly showMarkers?: () => boolean
}

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

const MARKERS: Record<RowTone, string> = {
  added: '+',
  removed: '-',
  changed: '~',
  normal: '',
  spacer: '',
}

/**
 * A gutter and a text column over one scroll container, virtualized.
 *
 * This is the shape both elements are built from: a viewer is one of these, and
 * a split diff is two kept in lockstep.
 */
export class Column {
  readonly scroll: HTMLDivElement
  readonly canvas: HTMLDivElement
  readonly gutter: HTMLDivElement
  readonly lines: HTMLDivElement

  #host: ColumnHost
  #strut: HTMLDivElement
  #rows: readonly ColumnRow[] = []
  #virtualizer: Virtualizer<HTMLDivElement, Element>
  #unmount: (() => void) | null = null
  /** The row the arrows move from, and the only one that is tabbable. */
  #active = 0
  /**
   * Focus is only moved for a reader already inside the document. Without this
   * the first paint of a page would steal the caret.
   */
  #holdsFocus = false
  /**
   * True while the rows are being replaced. Removing the focused row fires a
   * blur with nowhere to go, which is not the reader leaving the document — and
   * treating it as one would drop focus on every arrow key.
   */
  #painting = false

  constructor(host: ColumnHost) {
    this.#host = host
    this.#strut = el('div', 'krona-width-strut')
    this.#strut.setAttribute('aria-hidden', 'true')
    this.gutter = el('div', 'krona-column krona-gutter')
    this.lines = el('div', 'krona-column krona-column--lines krona-lines')
    this.lines.setAttribute('role', 'tree')
    this.lines.append(this.#strut)
    this.canvas = el('div', 'krona-canvas', [this.gutter, this.lines])
    this.scroll = el('div', 'krona-scroll', [this.canvas])

    this.lines.addEventListener('keydown', (event) => this.#onKeyDown(event))
    this.lines.addEventListener('focusin', (event) => {
      this.#holdsFocus = true
      // Tabbing onto a row, or clicking one, makes it the row the arrows move
      // from. Focus landing on something inside a row leaves the index alone.
      const index = (event.target as HTMLElement).dataset?.index
      if (index !== undefined) this.#active = Number(index)
    })
    this.lines.addEventListener('focusout', (event) => {
      if (this.#painting) return
      if (this.lines.contains(event.relatedTarget as Node | null)) return
      this.#holdsFocus = false
    })

    this.#virtualizer = new Virtualizer<HTMLDivElement, Element>({
      count: 0,
      getScrollElement: () => this.scroll,
      estimateSize: () => host.lineHeight(),
      overscan: host.overscan(),
      scrollToFn: elementScroll,
      observeElementRect,
      observeElementOffset,
      onChange: () => this.paint(),
    })
  }

  /** Starts observing the scroll container. Call when the element is connected. */
  mount(): void {
    this.#unmount ??= this.#virtualizer._didMount()
  }

  unmount(): void {
    this.#unmount?.()
    this.#unmount = null
  }

  get rowCount(): number {
    return this.#rows.length
  }

  /** Replaces the rows and repaints. */
  update(rows: readonly ColumnRow[]): void {
    this.#rows = rows
    const virtualizer = this.#virtualizer
    virtualizer.setOptions({
      ...virtualizer.options,
      count: rows.length,
      overscan: this.#host.overscan(),
      estimateSize: () => this.#host.lineHeight(),
    })
    // What a framework adapter does on every render: the call that binds the
    // scroll element and starts the observers. Without it the virtualizer knows
    // the document's height but never which rows are on screen.
    virtualizer._willUpdate()
    virtualizer.measure()
    this.#strut.style.width = `${this.#host.contentColumns()}ch`
    this.lines.setAttribute('aria-label', this.#host.labels().document)
    this.paint()
  }

  /** Brings a row into view, if it is on screen at all. */
  scrollToRow(index: number): void {
    if (index >= 0) this.#virtualizer.scrollToIndex(index, { align: 'center' })
  }

  /** Rebuilds the rows inside the scrolled window, and nothing outside it. */
  paint(): void {
    const host = this.#host
    const model = host.model()
    const total = this.#virtualizer.getTotalSize()
    this.canvas.style.height = `${total}px`
    this.gutter.style.height = `${total}px`
    this.lines.style.height = `${total}px`

    const digits = Math.max(2, String(model.lines.length).length)
    const items = this.#virtualizer.getVirtualItems()
    const gutterRows: HTMLElement[] = []
    const lineRows: HTMLElement[] = [this.#strut]

    for (const item of items) {
      const row = this.#rows[item.index]
      if (!row) continue
      gutterRows.push(this.#gutterRow(row, item.start, digits))
      lineRows.push(this.#lineRow(model, row, item.index, item.start))
    }

    this.gutter.replaceChildren(...gutterRows)
    this.#painting = true
    this.lines.replaceChildren(...lineRows)
    this.#painting = false

    // The index can outlive the rows it pointed into — a fold closes, a
    // document is replaced — and a tree with no tabbable item cannot be entered
    // at all.
    if (this.#rows.length > 0 && !this.#navigable(this.#active)) {
      this.#active = this.#edge(1)
    }
    if (this.#holdsFocus) {
      this.lines.querySelector<HTMLElement>(`[data-index="${this.#active}"]`)?.focus()
    }
  }

  /**
   * Arrow-key movement over the rows, with one of them tabbable.
   *
   * A document is a tree, and a tree is walked with the arrows — Tab through
   * every line of a lockfile is not navigation. Only the current row is
   * tabbable, so Tab enters the document once and leaves it once, which is the
   * roving-tabindex pattern every tree widget uses.
   */
  #onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement
    // Any field a host put inside the document owns its own arrow keys.
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return

    const fold = this.#foldOf(this.#active)
    switch (event.key) {
      case 'ArrowDown':
        this.#go(this.#step(this.#active, 1))
        break
      case 'ArrowUp':
        this.#go(this.#step(this.#active, -1))
        break
      case 'Home':
        this.#go(this.#edge(1))
        break
      case 'End':
        this.#go(this.#edge(-1))
        break
      case 'ArrowRight':
        // Open what is closed, otherwise walk into it — the same key doing both
        // is what makes a tree feel like a tree.
        if (fold?.folded) this.#host.toggleFold(fold.range.startLine)
        else this.#go(this.#step(this.#active, 1))
        break
      case 'ArrowLeft':
        if (fold && !fold.folded) this.#host.toggleFold(fold.range.startLine)
        else this.#go(this.#parentOf(this.#active))
        break
      case 'Enter':
      case ' ':
        // Only when the row itself has focus: a control inside it keeps its own
        // Enter.
        if (!target.classList.contains('krona-row') || !fold) return
        this.#host.toggleFold(fold.range.startLine)
        break
      default:
        return
    }
    // Reached only for a key that was handled, so the page does not scroll
    // under a reader stepping through lines.
    event.preventDefault()
  }

  #navigable(index: number): boolean {
    const row = this.#rows[index]
    // Spacers are the blank half of a changed pair — there is no line there to
    // stand on. An expand bar is a control, so it is a stop.
    return Boolean(row && (row.lineIndex !== null || row.expandRegion !== undefined))
  }

  #step(from: number, direction: 1 | -1): number {
    for (let i = from + direction; i >= 0 && i < this.#rows.length; i += direction) {
      if (this.#navigable(i)) return i
    }
    return from
  }

  #edge(direction: 1 | -1): number {
    return this.#step(direction === 1 ? -1 : this.#rows.length, direction)
  }

  #go(index: number): void {
    if (index === this.#active) return
    this.#active = index
    // The row may not be in the DOM yet; scrolling to it renders it, and the
    // paint that follows is where focus lands.
    this.#virtualizer.scrollToIndex(index)
    this.paint()
  }

  /** The row that encloses this one: the nearest row above it a level up. */
  #parentOf(index: number): number {
    const row = this.#rows[index]
    if (!row || row.lineIndex === null) return index
    const model = this.#host.model()
    const level = nestingLevelAt(model, row.lineIndex)
    if (level <= 1) return index
    for (let i = index - 1; i >= 0; i--) {
      const above = this.#rows[i]
      if (!above || above.lineIndex === null) continue
      if (nestingLevelAt(model, above.lineIndex) < level) return i
    }
    return index
  }

  #foldOf(index: number): { range: FoldRange; folded: boolean } | undefined {
    const row = this.#rows[index]
    if (!row || row.lineIndex === null) return undefined
    const range = this.#host.foldAt(row.lineIndex)
    if (!range) return undefined
    return { range, folded: this.#host.isFolded(range.startLine) }
  }

  #selected(lineIndex: number | null): string {
    if (lineIndex === null) return ''
    return lineIndex === this.#host.selectedLine?.() ? ' krona-row--selected' : ''
  }

  #gutterRow(row: ColumnRow, offset: number, digits: number): HTMLElement {
    const host = this.#host
    if (row.expandRegion !== undefined) {
      const bar = el('div', 'krona-row krona-row--expand')
      bar.style.transform = `translateY(${offset}px)`
      return bar
    }

    const { lineIndex, tone } = row
    const parts: Node[] = []
    if (host.showMarkers?.() && MARKERS[tone]) {
      parts.push(el('span', 'krona-gutter-marker', MARKERS[tone]))
    }
    const number = el(
      'span',
      'krona-gutter-number',
      lineIndex === null ? '' : String(lineIndex + 1),
    )
    number.style.minWidth = `${digits}ch`
    parts.push(number)

    const range = lineIndex === null ? undefined : host.foldAt(lineIndex)
    parts.push(range ? chevron() : el('span', 'krona-fold-spacer'))

    const picked = this.#selected(lineIndex)
    // A foldable line makes its whole gutter cell the control: a 16px chevron
    // between a number and the code reads as punctuation, not as a target.
    if (!range) {
      const cell = el('div', `krona-row krona-row--${tone}${picked}`, parts)
      cell.style.transform = `translateY(${offset}px)`
      return cell
    }
    const folded = host.isFolded(range.startLine)
    const labels = host.labels()
    const name = folded ? labels.expandBlock : labels.collapseBlock
    const button = el('button', `krona-row krona-row--${tone}${picked} krona-fold-toggle`, parts)
    button.type = 'button'
    button.style.transform = `translateY(${offset}px)`
    // Out of the tab order, not out of the accessibility tree: tabbing chevron
    // by chevron was never navigation, and virtualized rows could not all be
    // reached that way in any case.
    button.tabIndex = -1
    button.setAttribute('aria-expanded', folded ? 'false' : 'true')
    button.setAttribute('aria-label', name)
    button.title = name
    button.addEventListener('click', () => host.toggleFold(range.startLine))
    return button
  }

  #lineRow(model: DocumentModel, row: ColumnRow, index: number, offset: number): HTMLElement {
    const { lineIndex, tone } = row
    if (row.expandRegion !== undefined) {
      const bar = el('div', 'krona-row krona-row--expand', [this.#expandBar(row.expandRegion)])
      bar.style.transform = `translateY(${offset}px)`
      bar.dataset.index = String(index)
      bar.setAttribute('role', 'treeitem')
      bar.tabIndex = index === this.#active ? 0 : -1
      bar.setAttribute('aria-level', '1')
      bar.setAttribute('aria-posinset', String(index + 1))
      bar.setAttribute('aria-setsize', String(this.#rows.length))
      return bar
    }
    if (lineIndex === null) {
      const spacer = el('div', 'krona-row krona-row--spacer')
      spacer.style.transform = `translateY(${offset}px)`
      // The blank half of a changed pair: there is no line here, so there is
      // nothing for a reader to be told about.
      spacer.setAttribute('aria-hidden', 'true')
      return spacer
    }

    const text = model.lines[lineIndex]?.text ?? ''
    const range = this.#host.foldAt(lineIndex)
    const folded = range ? this.#host.isFolded(range.startLine) : false
    const element = el(
      'div',
      `krona-row krona-row--${tone}${this.#selected(lineIndex)}`,
      this.#segments(model, lineIndex, text, row),
    )
    element.style.transform = `translateY(${offset}px)`
    element.dataset.line = String(lineIndex + 1)
    element.dataset.index = String(index)
    element.setAttribute('role', 'treeitem')
    element.tabIndex = index === this.#active ? 0 : -1
    element.setAttribute('aria-level', String(nestingLevelAt(model, lineIndex)))
    element.setAttribute('aria-posinset', String(index + 1))
    element.setAttribute('aria-setsize', String(this.#rows.length))
    if (range) element.setAttribute('aria-expanded', folded ? 'false' : 'true')
    if (folded && range) element.append(this.#placeholder(range))
    return element
  }

  /** One line's text, cut into token, highlight and unsafe-character runs. */
  #segments(model: DocumentModel, lineIndex: number, text: string, row: ColumnRow): Node[] {
    const segments = buildSegments(
      text,
      model.tokensAt(lineIndex),
      row.intraline,
      row.wholeLine ?? false,
    )
    if (segments.length === 0) return [document.createTextNode(text)]
    return segments.map((segment) => {
      if (segment.unsafe) {
        // Rendering the character itself would let bidi controls reorder the
        // line and zero-width ones vanish, making the view lie about the file.
        const marker = el('span', 'krona-unsafe', segment.unsafe.label)
        marker.title = this.#host.labels().unsafeCharacter(segment.unsafe.label)
        return marker
      }
      const value = text.slice(segment.start, segment.end)
      const classes: string[] = []
      if (segment.token) classes.push(`krona-token--${segment.token}`)
      if (segment.changed) classes.push('krona-intraline')
      if (classes.length === 0) return document.createTextNode(value)
      return el('span', classes.join(' '), value)
    })
  }

  #placeholder(range: FoldRange): HTMLElement {
    const labels = this.#host.labels()
    const hidden = range.endLine - range.startLine
    const inside =
      range.childCount === undefined
        ? labels.foldedLines(hidden)
        : labels.foldedItems(range.childCount)
    const brackets = BRACKETS[range.kind]
    const button = el(
      'button',
      'krona-fold-placeholder',
      brackets ? `${brackets[0]} ${inside} ${brackets[1]}` : inside,
    )
    button.type = 'button'
    button.title = labels.expandBlock
    button.addEventListener('click', () => this.#host.toggleFold(range.startLine))
    return button
  }

  #expandBar(index: number): HTMLElement {
    const host = this.#host
    const labels = host.labels()
    const region = host.region?.(index)
    const bar = el('div', 'krona-expand-bar')
    if (!region || !host.expandContext) return bar

    const interactive = host.barsAreControls?.() !== false
    if (!interactive) bar.setAttribute('aria-hidden', 'true')
    const hidden = region.endRow - region.startRow + 1
    const step = host.step?.() ?? 20

    const actions = el('span', 'krona-expand-actions')
    const action = (name: string, glyph: string, direction: ExpandDirection) => {
      const button = el('button', 'krona-expand-action', glyph)
      button.type = 'button'
      button.title = name
      button.setAttribute('aria-label', name)
      if (!interactive) button.tabIndex = -1
      button.addEventListener('click', () => host.expandContext?.(index, direction))
      return button
    }
    if (step < hidden) {
      actions.append(action(labels.expandUp, '↑', 'up'), action(labels.expandDown, '↓', 'down'))
    }
    actions.append(action(labels.expandAllHidden, '⇅', 'all'))
    bar.append(actions, el('span', undefined, labels.hiddenLines(hidden)))
    return bar
  }
}

/**
 * Keeps several scroll containers in lockstep, on both axes.
 *
 * The panels of a diff render the same aligned rows at the same fixed height,
 * so they are identical in height and syncing is an exact `scrollTop` copy
 * rather than a ratio — no drift, no rounding. The horizontal axis copies just
 * as exactly, because both reserve the same content width: comparing two
 * versions of a line means reading the same column in both.
 */
export class ScrollSync {
  #elements = new Set<HTMLElement>()
  #syncing = false

  #onScroll = (event: Event) => {
    if (this.#syncing) return
    const source = event.currentTarget as HTMLElement
    this.#syncing = true
    for (const element of this.#elements) {
      if (element === source) continue
      if (element.scrollTop !== source.scrollTop) element.scrollTop = source.scrollTop
      if (element.scrollLeft !== source.scrollLeft) element.scrollLeft = source.scrollLeft
    }
    // Released on the next frame: the assignments above fire their own scroll
    // events, and re-entering here would ping-pong the panels.
    requestAnimationFrame(() => {
      this.#syncing = false
    })
  }

  register(element: HTMLElement): void {
    this.#elements.add(element)
    element.addEventListener('scroll', this.#onScroll, { passive: true })
  }

  release(): void {
    for (const element of this.#elements) element.removeEventListener('scroll', this.#onScroll)
    this.#elements.clear()
  }
}
