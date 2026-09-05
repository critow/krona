import {
  collapsedToDepth,
  contentColumnsOf,
  type DocumentModel,
  type Format,
  visibleLines as visibleLinesOf,
} from '@kronajs/core'
import { KronaBase, type KronaChangeDetail, type KronaSelectLineDetail } from './base'
import { Column, type ColumnRow } from './column'
import { EditSession } from './editing'
import { SearchBox } from './search'

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
 *   import { defineKrona } from '@kronajs/element'
 *   import '@kronajs/element/yaml'
 *   defineKrona()
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
 * Comparing two versions is `<krona-diff>`.
 */
export class KronaViewerElement extends KronaBase {
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
    'show-search',
    'show-actions',
    'editable',
  ]

  #source = ''
  #model: DocumentModel | null = null
  #collapsed = new Set<number>()
  /** Line indices on screen, in order — the rows the virtualizer counts. */
  #visible: number[] = []
  /** Set until the first render, so an opening depth is applied exactly once. */
  #needsDefaultFold = true
  /** The document the open query was run against, so it is run again when it changes. */
  #searched: DocumentModel | null = null
  #column: Column
  #search: SearchBox
  #edit: EditSession

  constructor() {
    super('krona-viewer')
    this.#column = new Column({
      labels: () => this.currentLabels,
      lineHeight: () => this.lineHeight,
      overscan: () => this.overscan,
      model: () => this.#parsed(),
      contentColumns: () => contentColumnsOf(this.#parsed()),
      foldAt: (lineIndex) => this.#parsed().foldAt(lineIndex),
      isFolded: (startLine) => this.#collapsed.has(startLine),
      toggleFold: (startLine) => this.#toggleFold(startLine),
      selectedLine: () => this.selectedLine,
      editing: () => this.#editing,
      actions: () => ({
        labels: () => this.currentLabels,
        showCopy: () => this.getAttribute('show-actions') !== 'false',
        editing: () => this.#editing,
        // The action only appears where someone is listening for it: a control
        // that reports a line nobody receives is a control that does nothing.
        ...(this.#wantsLinks
          ? { selectLine: (lineIndex: number) => this.#emitSelect(lineIndex + 1) }
          : {}),
      }),
      search: () => this.#search,
    })
    this.#search = new SearchBox({
      labels: () => this.currentLabels,
      target: () => ({ kind: 'single', model: this.#parsed() }),
      // A match may be inside a folded block and outside the rendered window,
      // so jumping to one opens whatever hides it and only then scrolls.
      reveal: (hit) => this.revealLine(hit.lineIndex + 1),
      repaint: () => this.#column.paint(),
    })
    this.#edit = new EditSession(
      {
        labels: () => this.currentLabels,
        model: () => this.#parsed(),
        lineHeight: () => this.lineHeight,
        changed: (source) => this.#changed(source),
        repaint: () => this.#column.paint(),
        unfold: (startLine) => {
          if (!this.#collapsed.delete(startLine)) return
          this.render()
        },
      },
      this.#source,
    )
    this.section.append(this.#column.scroll)
  }

  /** The file to show. A property, because a document is not markup. */
  get source(): string {
    return this.#source
  }

  set source(value: string) {
    if (value === this.#source) return
    this.#source = value
    // A history of edits to the previous file describes lines this one does not
    // have, so new text starts a new history.
    this.#edit.reseed(value)
    this.#model = null
    this.#needsDefaultFold = true
    this.schedule()
  }

  /** The parsed document currently on screen, or null before the first render. */
  get model(): DocumentModel | null {
    return this.#model
  }

  /** Whether there is anything to undo. False where the viewer is read-only. */
  get canUndo(): boolean {
    return this.#editable && this.#edit.canUndo
  }

  get canRedo(): boolean {
    return this.#editable && this.#edit.canRedo
  }

  /** Takes back the last edit, and says so through `krona-change`. */
  undo(): void {
    if (this.#editable) this.#edit.undo()
  }

  redo(): void {
    if (this.#editable) this.#edit.redo()
  }

  /** Opens every folding range. */
  expandAll(): void {
    if (this.#collapsed.size === 0) return
    this.#collapsed = new Set()
    this.schedule()
  }

  /** Closes every folding range. */
  collapseAll(): void {
    this.#collapsed = new Set(this.#parsed().foldingRanges.map((range) => range.startLine))
    this.schedule()
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
    this.render()
    this.#column.scrollToRow(this.#visible.indexOf(lineIndex))
  }

  override connectedCallback(): void {
    this.#column.mount()
    super.connectedCallback()
  }

  override disconnectedCallback(): void {
    this.#column.unmount()
    super.disconnectedCallback()
  }

  override attributeChangedCallback(
    name: string,
    previous: string | null,
    value: string | null,
  ): void {
    if (previous === value) return
    if (name === 'source') {
      this.source = value ?? ''
      return
    }
    // Anything else changes how the same document is shown, not what it is.
    if (name === 'format') this.#model = null
    if (name === 'collapsed-depth') this.#needsDefaultFold = true
    this.schedule()
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
      this.#model = this.parse(this.#source, (this.getAttribute('format') ?? 'auto') as Format)
    }
    if (this.#needsDefaultFold) {
      this.#needsDefaultFold = false
      this.#collapsed = collapsedToDepth(this.#model, this.collapsedDepth)
    }
    return this.#model
  }

  /**
   * Attaches or detaches the search field.
   *
   * Detached rather than hidden: `.krona-search` sets `display: flex`, which
   * outranks the browser's rule for `hidden`, so a hidden field would still be
   * on screen.
   */
  #paintSearch(): void {
    const wanted = this.getAttribute('show-search') === 'true'
    if (wanted === this.#search.root.isConnected) return
    if (wanted) this.section.insertBefore(this.#search.root, this.#column.scroll)
    else this.#search.root.remove()
  }

  /**
   * Whether the reader may change the file.
   *
   * Presence is enough — `editable` is a boolean attribute — but `false` is
   * honoured too, because a framework binding a boolean writes it out.
   */
  get #editable(): boolean {
    return this.hasAttribute('editable') && this.getAttribute('editable') !== 'false'
  }

  /** The editing session, where there is one: a read-only viewer offers none. */
  get #editing(): EditSession | undefined {
    return this.#editable ? this.#edit : undefined
  }

  /**
   * Takes in the result of an edit: the element's text is now the session's.
   *
   * The fold state is seeded again rather than kept, because an edit moves the
   * lines under it — a range recorded as starting on line 12 may now start on
   * line 9, and folding what that number points at afterwards would close a
   * block the reader never touched.
   */
  #changed(source: string): void {
    this.#source = source
    this.#model = null
    this.#needsDefaultFold = true
    this.render()
    this.dispatchEvent(
      new CustomEvent<KronaChangeDetail>('krona-change', {
        bubbles: true,
        composed: true,
        detail: { source },
      }),
    )
  }

  /** Whether anyone asked to hear which line was picked. */
  get #wantsLinks(): boolean {
    return this.hasAttribute('link-lines')
  }

  /**
   * Says which line the reader picked out.
   *
   * A line, counting from 1, because that is the number a link carries and the
   * one the gutter shows.
   */
  #emitSelect(line: number): void {
    this.dispatchEvent(
      new CustomEvent<KronaSelectLineDetail>('krona-select-line', {
        bubbles: true,
        composed: true,
        detail: { line },
      }),
    )
  }

  #toggleFold(startLine: number): void {
    const folded = this.#collapsed.has(startLine)
    if (folded) this.#collapsed.delete(startLine)
    else this.#collapsed.add(startLine)
    this.render()
    this.emitFold(startLine + 1, !folded)
  }

  protected override render(): void {
    const model = this.#parsed()
    this.paintFrame(model.diagnostics)
    this.#paintSearch()
    // Matches found in a file that has since been replaced would point at lines
    // that are no longer there.
    if (this.#searched !== model) {
      this.#searched = model
      this.#search.refresh()
    }
    this.#visible = visibleLinesOf(model, this.#collapsed)
    this.#column.update(
      this.#visible.map<ColumnRow>((lineIndex) => ({ lineIndex, tone: 'normal' })),
    )
  }
}
