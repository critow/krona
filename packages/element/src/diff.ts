import {
  type AlignedDiff,
  type AlignedRow,
  alignDiff,
  buildRowIndex,
  type CollapsedRegion,
  collapseUnchanged,
  contentColumnsOf,
  type DisplayItem,
  type DocumentModel,
  diffLines,
  displayItems,
  type ExpandDirection,
  type Format,
  hasFoldAt,
  type IntralineResult,
  intralineDiff,
  type RowIndex,
  unifiedEntries,
} from '@kronajs/core'
import { KronaBase } from './base'
import { Column, type ColumnRow, ScrollSync } from './column'
import { el } from './dom'

const TONE = {
  equal: 'normal',
  added: 'added',
  removed: 'removed',
  changed: 'changed',
} as const

const NO_INTRALINE: IntralineResult = { left: [], right: [], wholeLine: false }

/**
 * How one row of a unified column reads on its own.
 *
 * A changed pair arrives as two rows, so each says what it is by itself: the
 * line that went, then the line that came. `changed` is a statement about two
 * lines sitting side by side, and here there is no second column to sit beside.
 */
function unifiedTone(kind: AlignedRow['kind'], isLeft: boolean): ColumnRow['tone'] {
  if (kind === 'equal') return 'normal'
  if (kind === 'changed') return isLeft ? 'removed' : 'added'
  return kind
}

/**
 * `<krona-diff>` — two versions of a configuration file, side by side.
 *
 * The same alignment, folding, word-level highlighting and hidden-run
 * collapsing as `Krona.Diff`, without React. Both panels render one shared row
 * list at one fixed row height, so folding a block hides it on both sides and
 * the two scroll in exact lockstep rather than by a ratio.
 *
 * @example
 * ```html
 * <krona-diff format="json" collapse-unchanged></krona-diff>
 * <script type="module">
 *   const diff = document.querySelector('krona-diff')
 *   diff.left = before
 *   diff.right = after
 * </script>
 * ```
 *
 * What this element does not do, which `Krona.Diff` does: the unified
 * one-column view, the minimap, searching, and the one-panel-at-a-time layout
 * for narrow screens.
 */
export class KronaDiffElement extends KronaBase {
  static readonly observedAttributes = [
    'left',
    'right',
    'format',
    'theme',
    'locale',
    'line-height',
    'collapsed-depth',
    'overscan',
    'show-diagnostics',
    'show-toolbar',
    'collapse-unchanged',
    'context',
    'minimum-hidden',
    'step',
    'ignore-trailing-whitespace',
    'narrow-width',
    'view',
  ]

  #left = ''
  #right = ''
  #models: { left: DocumentModel; right: DocumentModel } | null = null
  #aligned: AlignedDiff | null = null
  #rowIndex: RowIndex | null = null
  /** Folded rows, not lines: a fold hides the matching row in both panels. */
  #collapsed = new Set<number>()
  /** Hidden runs of unchanged rows; a null entry is one the reader opened. */
  #regions: (CollapsedRegion | null)[] = []
  #items: readonly DisplayItem[] = []
  #needsSeed = true
  #intraline = new Map<number, IntralineResult>()

  #toolbar: HTMLDivElement
  #switch: HTMLFieldSetElement
  #panels: HTMLDivElement
  #leftPanel: HTMLElement
  #rightPanel: HTMLElement
  #unifiedPanel: HTMLElement
  #leftColumn: Column
  #rightColumn: Column
  #unifiedColumn: Column
  #sync = new ScrollSync()
  /**
   * Which version a narrow layout shows. The current one by default: a diff is
   * usually read to find out what a change did.
   */
  #side: 'left' | 'right' = 'right'

  constructor() {
    super('krona-diff')
    this.#toolbar = el('div', 'krona-toolbar')
    this.#toolbar.setAttribute('role', 'toolbar')
    this.#leftColumn = new Column(this.#hostFor('left'))
    this.#rightColumn = new Column(this.#hostFor('right'))
    this.#unifiedColumn = new Column(this.#unifiedHost())
    this.#leftPanel = this.#panel('left', this.#leftColumn)
    this.#rightPanel = this.#panel('right', this.#rightColumn)
    this.#unifiedPanel = this.#panel('unified', this.#unifiedColumn)
    this.#panels = el('div', 'krona-panels', [
      this.#leftPanel,
      this.#rightPanel,
      this.#unifiedPanel,
    ])
    this.#switch = this.#sideSwitch()
    this.section.append(this.#toolbar, this.#panels)
  }

  /** The previous version. A property, because a document is not markup. */
  get left(): string {
    return this.#left
  }

  set left(value: string) {
    if (value === this.#left) return
    this.#left = value
    this.#invalidate()
  }

  /** The current version. */
  get right(): string {
    return this.#right
  }

  set right(value: string) {
    if (value === this.#right) return
    this.#right = value
    this.#invalidate()
  }

  /** How the two versions line up, once there is a diff. */
  get aligned(): AlignedDiff | null {
    return this.#aligned
  }

  /** Opens every folded block and every hidden run. */
  expandAll(): void {
    this.#collapsed = new Set()
    this.#regions = this.#regions.map(() => null)
    this.schedule()
  }

  /** Closes every folding range on either side. */
  collapseAll(): void {
    const { left, right } = this.#parsed()
    const index = this.#index()
    const collapsed = new Set<number>()
    for (const range of left.foldingRanges) {
      const row = index.leftRowOf[range.startLine] ?? -1
      if (row >= 0) collapsed.add(row)
    }
    for (const range of right.foldingRanges) {
      const row = index.rightRowOf[range.startLine] ?? -1
      if (row >= 0) collapsed.add(row)
    }
    this.#collapsed = collapsed
    this.schedule()
  }

  override connectedCallback(): void {
    this.#leftColumn.mount()
    this.#rightColumn.mount()
    this.#unifiedColumn.mount()
    this.#sync.register(this.#leftColumn.scroll)
    this.#sync.register(this.#rightColumn.scroll)
    super.connectedCallback()
  }

  override disconnectedCallback(): void {
    this.#leftColumn.unmount()
    this.#rightColumn.unmount()
    this.#unifiedColumn.unmount()
    this.#sync.release()
    super.disconnectedCallback()
  }

  override attributeChangedCallback(
    name: string,
    previous: string | null,
    value: string | null,
  ): void {
    if (previous === value) return
    if (name === 'left') {
      this.left = value ?? ''
      return
    }
    if (name === 'right') {
      this.right = value ?? ''
      return
    }
    // These change what is compared or what is hidden to begin with, so the
    // reader's own folding is seeded again rather than carried over.
    if (
      name === 'format' ||
      name === 'ignore-trailing-whitespace' ||
      name === 'collapsed-depth' ||
      name === 'collapse-unchanged' ||
      name === 'context' ||
      name === 'minimum-hidden'
    ) {
      this.#invalidate()
      return
    }
    this.schedule()
  }

  #invalidate(): void {
    this.#models = null
    this.#aligned = null
    this.#rowIndex = null
    this.#intraline = new Map()
    this.#needsSeed = true
    this.schedule()
  }

  #parsed(): { left: DocumentModel; right: DocumentModel } {
    if (!this.#models) {
      const format = (this.getAttribute('format') ?? 'auto') as Format
      this.#models = {
        left: this.parse(this.#left, format),
        right: this.parse(this.#right, format),
      }
    }
    return this.#models
  }

  #diff(): AlignedDiff {
    if (!this.#aligned) {
      const { left, right } = this.#parsed()
      this.#aligned = alignDiff(
        diffLines(left.source, right.source, {
          ignoreTrailingWhitespace: this.hasAttribute('ignore-trailing-whitespace'),
        }),
      )
    }
    return this.#aligned
  }

  #index(): RowIndex {
    if (!this.#rowIndex) {
      const { left, right } = this.#parsed()
      this.#rowIndex = buildRowIndex(this.#diff().rows, left, right)
    }
    return this.#rowIndex
  }

  /**
   * The opening state: which blocks are folded and which unchanged runs are
   * hidden. Seeded once per diff, so a repaint for an unrelated reason does not
   * fold the document again under the reader.
   */
  #seed(): void {
    if (!this.#needsSeed) return
    this.#needsSeed = false
    const { left, right } = this.#parsed()
    const rows = this.#diff().rows
    const index = this.#index()

    const depth = this.collapsedDepth
    const collapsed = new Set<number>()
    if (depth !== undefined) {
      for (const range of left.foldingRanges) {
        if (range.level < depth) continue
        const row = index.leftRowOf[range.startLine] ?? -1
        if (row >= 0) collapsed.add(row)
      }
      for (const range of right.foldingRanges) {
        if (range.level < depth) continue
        const row = index.rightRowOf[range.startLine] ?? -1
        if (row >= 0) collapsed.add(row)
      }
    }
    this.#collapsed = collapsed

    if (!this.hasAttribute('collapse-unchanged')) {
      this.#regions = []
      return
    }
    // Rows that open a folding range must survive the unchanged-run collapse:
    // hiding one takes its chevron with it, and a file whose only foldable line
    // sits in an unchanged run would offer nothing to fold.
    const keepRows = new Set<number>()
    for (let row = 0; row < rows.length; row++) {
      if (hasFoldAt(row, rows, left, right)) keepRows.add(row)
    }
    const context = this.#number('context')
    const minimumHidden = this.#number('minimum-hidden')
    this.#regions = collapseUnchanged(rows, {
      keepRows,
      ...(context === undefined ? {} : { context }),
      ...(minimumHidden === undefined ? {} : { minimumHidden }),
    })
  }

  #number(attribute: string): number | undefined {
    const raw = this.getAttribute(attribute)
    if (raw === null || raw === '') return undefined
    const value = Number(raw)
    return Number.isNaN(value) ? undefined : value
  }

  #step(): number {
    return this.#number('step') ?? 20
  }

  /** Word-level spans for one changed row, computed once and kept. */
  #intralineAt(row: number): IntralineResult {
    const cached = this.#intraline.get(row)
    if (cached) return cached
    const aligning = this.#diff().rows[row]
    if (aligning?.kind !== 'changed' || aligning.left === null || aligning.right === null) {
      return NO_INTRALINE
    }
    const { left, right } = this.#parsed()
    const result = intralineDiff(
      left.lines[aligning.left]?.text ?? '',
      right.lines[aligning.right]?.text ?? '',
    )
    this.#intraline.set(row, result)
    return result
  }

  #panel(side: 'left' | 'right' | 'unified', column: Column): HTMLElement {
    return el('section', `krona-panel krona-panel--${side}`, [column.scroll])
  }

  /**
   * Whether both versions share one column.
   *
   * `auto` splits where there is room and unifies below `narrow-width`: two
   * panels on a phone are two unreadable panels, and one column needs only the
   * width of a single line.
   */
  get #unified(): boolean {
    const view = this.getAttribute('view')
    return view === 'unified' || (view !== 'split' && this.narrow)
  }

  /** The two versions read as one column, the way `git diff` prints one. */
  #unifiedHost() {
    const rowFor = (startLine: number, side?: 'left' | 'right') =>
      (side === 'left' ? this.#index().leftRowOf : this.#index().rightRowOf)[startLine] ?? -1
    return {
      labels: () => this.currentLabels,
      lineHeight: () => this.lineHeight,
      overscan: () => this.overscan,
      // The right-hand version is the column's own document: it is the file the
      // reader still has, and the one an unchanged row is read from.
      model: () => this.#parsed().right,
      maxLineNumber: () =>
        Math.max(this.#parsed().left.lines.length, this.#parsed().right.lines.length),
      contentColumns: () => contentColumnsOf(this.#parsed().left, this.#parsed().right),
      foldAt: (lineIndex: number, side?: 'left' | 'right') =>
        (side === 'left' ? this.#parsed().left : this.#parsed().right).foldAt(lineIndex),
      isFolded: (startLine: number, side?: 'left' | 'right') =>
        this.#collapsed.has(rowFor(startLine, side)),
      toggleFold: (startLine: number, side?: 'left' | 'right') =>
        this.#toggleRow(rowFor(startLine, side), startLine),
      region: (index: number) => this.#regions[index] ?? undefined,
      expandContext: (index: number, direction: ExpandDirection) =>
        this.#expandContext(index, direction),
      step: () => this.#step(),
      showMarkers: () => this.getAttribute('show-markers') !== 'false',
    }
  }

  /** The rows of the unified column: the same alignment, read down one column. */
  #unifiedRows(): ColumnRow[] {
    const { left, right } = this.#parsed()
    const rows = this.#diff().rows
    return unifiedEntries(this.#items, rows).map<ColumnRow>((entry) => {
      if (entry.regionIndex !== undefined) {
        return { lineIndex: null, tone: 'spacer', expandRegion: entry.regionIndex }
      }
      const aligned = rows[entry.rowIndex] as AlignedRow
      const isLeft = entry.side === 'left'
      const lineIndex = isLeft ? aligned.left : aligned.right
      if (lineIndex === null) return { lineIndex: null, tone: 'spacer' }
      const base = {
        lineIndex,
        tone: unifiedTone(aligned.kind, isLeft),
        model: isLeft ? left : right,
        side: isLeft ? ('left' as const) : ('right' as const),
      }
      if (aligned.kind !== 'changed') return base
      const intraline = this.#intralineAt(entry.rowIndex)
      return {
        ...base,
        intraline: isLeft ? intraline.left : intraline.right,
        wholeLine: intraline.wholeLine,
      }
    })
  }

  /**
   * Which version a narrow diff shows.
   *
   * A fieldset rather than a labelled group: two buttons that pick one of two
   * things are a set of choices, and the element for that already exists.
   */
  #sideSwitch(): HTMLFieldSetElement {
    const group = document.createElement('fieldset')
    group.className = 'krona-side-switch'
    group.append(el('legend', 'krona-sr-only'))
    for (const side of ['left', 'right'] as const) {
      const button = el('button')
      button.type = 'button'
      button.addEventListener('click', () => this.showSide(side))
      group.append(button)
    }
    return group
  }

  /** Chooses the version a narrow layout shows. */
  showSide(side: 'left' | 'right'): void {
    if (side === this.#side) return
    this.#side = side
    this.schedule()
  }

  /**
   * Which panels are on screen.
   *
   * They are attached and detached rather than hidden. `hidden` is a UA rule of
   * the lowest specificity and `.krona-panel` sets `display: flex`, so a hidden
   * panel stays on screen — and, being in the DOM, goes on painting rows nobody
   * asked for.
   */
  #paintLayout(): void {
    const unified = this.#unified
    const narrow = this.narrow
    // Splitting the width of a phone between two panels gives about ten
    // characters each, which shows neither version.
    const panels = unified
      ? [this.#unifiedPanel]
      : narrow
        ? [this.#side === 'left' ? this.#leftPanel : this.#rightPanel]
        : [this.#leftPanel, this.#rightPanel]
    // Only when the set actually changes. Replacing the children on every
    // render would detach and re-attach the panels for each fold and each
    // keystroke, which throws away their scroll position and makes the
    // virtualizer measure a container that is briefly nowhere.
    const current = [...this.#panels.children]
    if (current.length !== panels.length || panels.some((panel, i) => current[i] !== panel)) {
      this.#panels.replaceChildren(...panels)
    }

    // Nothing to switch between in a unified diff: both versions are already on
    // screen, one line above the other.
    const wantsSwitch = !unified && narrow
    if (wantsSwitch && !this.#switch.isConnected)
      this.section.insertBefore(this.#switch, this.#panels)
    else if (!wantsSwitch && this.#switch.isConnected) this.#switch.remove()
    const labels = this.currentLabels
    const legend = this.#switch.querySelector('legend')
    if (legend) legend.textContent = labels.document
    const [left, right] = this.#switch.querySelectorAll('button')
    if (left) {
      left.textContent = labels.leftPanel
      left.setAttribute('aria-pressed', String(this.#side === 'left'))
    }
    if (right) {
      right.textContent = labels.rightPanel
      right.setAttribute('aria-pressed', String(this.#side === 'right'))
    }
  }

  #hostFor(side: 'left' | 'right') {
    const isLeft = side === 'left'
    return {
      labels: () => this.currentLabels,
      lineHeight: () => this.lineHeight,
      overscan: () => this.overscan,
      model: () => (isLeft ? this.#parsed().left : this.#parsed().right),
      contentColumns: () => contentColumnsOf(this.#parsed().left, this.#parsed().right),
      foldAt: (lineIndex: number) =>
        (isLeft ? this.#parsed().left : this.#parsed().right).foldAt(lineIndex),
      // Folding is by row, not by line: the same block is hidden in both panels
      // or the two stop lining up.
      isFolded: (startLine: number) => this.#collapsed.has(this.#rowOf(side, startLine)),
      toggleFold: (startLine: number) => this.#toggleRow(this.#rowOf(side, startLine), startLine),
      region: (index: number) => this.#regions[index] ?? undefined,
      expandContext: (index: number, direction: ExpandDirection) =>
        this.#expandContext(index, direction),
      step: () => this.#step(),
      barsAreControls: () => isLeft,
      showMarkers: () => this.getAttribute('show-markers') !== 'false',
    }
  }

  #rowOf(side: 'left' | 'right', startLine: number): number {
    const index = this.#index()
    return (side === 'left' ? index.leftRowOf[startLine] : index.rightRowOf[startLine]) ?? -1
  }

  #toggleRow(row: number, startLine: number): void {
    if (row < 0) return
    const folded = this.#collapsed.has(row)
    if (folded) this.#collapsed.delete(row)
    else this.#collapsed.add(row)
    this.render()
    this.emitFold(startLine + 1, !folded)
  }

  #expandContext(index: number, direction: ExpandDirection): void {
    const region = this.#regions[index]
    if (!region) return
    this.#regions = [...this.#regions]
    this.#regions[index] = expandOne(region, direction, this.#step())
    this.render()
  }

  #rowsFor(side: 'left' | 'right'): ColumnRow[] {
    const isLeft = side === 'left'
    const rows = this.#diff().rows
    return this.#items.map<ColumnRow>((item) => {
      if (item.regionIndex !== undefined) {
        return { lineIndex: null, tone: 'spacer', expandRegion: item.regionIndex }
      }
      const aligned = rows[item.rowIndex] as AlignedRow
      const lineIndex = isLeft ? aligned.left : aligned.right
      if (lineIndex === null) return { lineIndex: null, tone: 'spacer' }
      if (aligned.kind !== 'changed') return { lineIndex, tone: TONE[aligned.kind] }
      const intraline = this.#intralineAt(item.rowIndex)
      return {
        lineIndex,
        tone: 'changed',
        intraline: isLeft ? intraline.left : intraline.right,
        wholeLine: intraline.wholeLine,
      }
    })
  }

  #paintToolbar(stats: AlignedDiff['stats']): void {
    const show = this.getAttribute('show-toolbar') !== 'false'
    this.#toolbar.hidden = !show
    if (!show) {
      this.#toolbar.replaceChildren()
      return
    }
    const labels = this.currentLabels
    this.#toolbar.setAttribute('aria-label', labels.document)
    const action = (text: string, run: () => void) => {
      const button = el('button', undefined, text)
      button.type = 'button'
      button.addEventListener('click', run)
      return button
    }
    this.#toolbar.replaceChildren(
      action(labels.expandAll, () => this.expandAll()),
      action(labels.collapseAll, () => this.collapseAll()),
      // A changed row is one line gone and one arrived, so it counts on both
      // sides — the same arithmetic the React toolbar does.
      el('span', 'krona-stat krona-stat--added', `${labels.added}: ${stats.added + stats.changed}`),
      el(
        'span',
        'krona-stat krona-stat--removed',
        `${labels.removed}: ${stats.removed + stats.changed}`,
      ),
    )
  }

  protected override render(): void {
    const { left, right } = this.#parsed()
    const diff = this.#diff()
    this.#seed()
    this.paintFrame([...left.diagnostics, ...right.diagnostics])
    this.#paintToolbar(diff.stats)
    this.#items = displayItems(
      diff.rows,
      left,
      right,
      this.#index(),
      this.#collapsed,
      this.#regions,
    )
    this.#paintLayout()
    if (this.#unified) {
      this.#unifiedColumn.update(this.#unifiedRows())
      return
    }
    this.#leftColumn.update(this.#rowsFor('left'))
    this.#rightColumn.update(this.#rowsFor('right'))
  }
}

/** One step of a hidden run, from whichever end the reader asked. */
function expandOne(
  region: CollapsedRegion,
  direction: ExpandDirection,
  step: number,
): CollapsedRegion | null {
  if (direction === 'all') return null
  const size = region.endRow - region.startRow + 1
  if (step >= size) return null
  return direction === 'up'
    ? { startRow: region.startRow + step, endRow: region.endRow }
    : { startRow: region.startRow, endRow: region.endRow - step }
}
