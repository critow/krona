import {
  blockSpanAt,
  contentColumnsOf,
  type DocumentModel,
  duplicateBlockEdit,
  type Format,
  formattedEdit,
  lineSpanAt,
  offsetOfLine,
  removeBlockEdit,
  visibleLines as visibleLinesOf,
} from '@kronajs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useKronaConfig } from '../context/config'
import {
  type EditTarget,
  type LineEditing,
  LineSourceContext,
  type RenderRow,
} from '../context/lineSource'
import { SearchContext } from '../context/search'
import { splitSlots } from '../context/slots'
import { useDocument } from '../hooks/useDocument'
import { useEditState } from '../hooks/useEditState'
import { useFoldState } from '../hooks/useFoldState'
import { type SearchHit, useSearch } from '../hooks/useSearch'
import { type KronaLabels, resolveLabels } from '../labels'
import { Diagnostics } from '../parts/Diagnostics'
import { Gutter } from '../parts/Gutter'
import { Lines } from '../parts/Lines'
import { Search } from '../parts/Search'
import { ViewerContext } from './ViewerContext'

/** Props of `<Krona.Viewer>`. */
export interface KronaViewerProps {
  /** File contents to display. Provide this or {@link KronaViewerProps.model}. */
  source?: string
  /**
   * A model parsed elsewhere — in a Web Worker, for instance — used as is.
   * Takes precedence over `source`.
   */
  model?: DocumentModel
  /** Overrides the format from the enclosing `<Krona>`. */
  format?: Format
  /** Overrides the labels from the enclosing `<Krona>`. */
  labels?: Partial<KronaLabels>
  /**
   * Collapse every folding range at this nesting depth or deeper on load.
   * `0` collapses everything; omit to start fully expanded.
   */
  defaultCollapsedDepth?: number
  /** Extra rows rendered outside the viewport. Default 8. */
  overscan?: number
  /** Show parse errors above the document. Default true. */
  showDiagnostics?: boolean
  /** Show the search field above the document. Default false. */
  showSearch?: boolean
  /**
   * Let the reader edit the document. Off by default.
   *
   * Editing is text editing: each change replaces a span of the source and the
   * result is parsed again, so the model stays an immutable list of lines and no
   * JavaScript object is ever built out of the file to be written back.
   *
   * The viewer owns the edited text from then on, re-seeding whenever `source`
   * (or `model`) changes — pass a new `source` to reset it.
   */
  editable?: boolean
  /** Called with the whole document after every edit, undo and redo. */
  onChange?: (source: string) => void
  /**
   * Single one line out: open whatever hides it, scroll to it and mark it.
   *
   * Counted the way the gutter counts, from 1, because this is the number that
   * ends up in a link — `#L42` is the forty-second line, and a prop that made
   * you subtract one would be wrong more often than right. `undefined` or `0`
   * marks nothing.
   */
  selectedLine?: number
  /**
   * Called with a line number, from 1, when the reader picks a line out. What
   * a link to it looks like is the host's business: Krona does not know the
   * page's URL and does not invent one.
   */
  onSelectLine?: (line: number) => void
  className?: string
  style?: CSSProperties
  /**
   * Custom layout. Without children the viewer renders its default layout,
   * assembled from the same public parts.
   */
  children?: ReactNode
}

/**
 * Read-only viewer with editor-style folding.
 *
 * @example
 * ```tsx
 * <Krona format="json">
 *   <Krona.Viewer source={text} defaultCollapsedDepth={2} />
 * </Krona>
 * ```
 *
 * @example Custom layout from the same parts
 * ```tsx
 * <Krona.Viewer source={text}>
 *   <MyHeader />
 *   <Krona.Gutter />
 *   <Krona.Lines />
 * </Krona.Viewer>
 * ```
 */
export function KronaViewer({
  source,
  model: providedModel,
  format,
  labels,
  defaultCollapsedDepth,
  overscan = 8,
  showDiagnostics = true,
  showSearch = false,
  editable = false,
  onChange,
  selectedLine,
  onSelectLine,
  className,
  style,
  children,
}: KronaViewerProps) {
  const config = useKronaConfig()
  // An editable viewer owns the text, so it has to own the parsing too: the
  // point of an edit is the model that comes out of re-parsing the result.
  const edit = useEditState(providedModel ? providedModel.source : (source ?? ''), onChange)
  const model = useDocument(
    editable ? edit.source : source,
    editable ? undefined : providedModel,
    format ?? config.format,
    config.limits,
    config.providers,
  )
  const foldState = useFoldState(model, defaultCollapsedDepth)

  const resolvedLabels = useMemo(
    () => (labels ? resolveLabels({ ...config.labels, ...labels }, config.locale) : config.labels),
    [labels, config.labels, config.locale],
  )

  const [target, setTarget] = useState<EditTarget | null>(null)

  const editing = useMemo<LineEditing | undefined>(() => {
    if (!editable) return undefined
    const open = (next: EditTarget | null) => setTarget(next)
    const spanText = (start: number, end: number) => model.source.slice(start, end)
    return {
      target,
      editValue: (lineIndex, start, end) => {
        const text = model.lines[lineIndex]?.text ?? ''
        open({
          kind: 'value',
          lineIndex,
          endLine: lineIndex,
          start,
          end,
          text: text.slice(start, end),
        })
      },
      editLine: (lineIndex) => {
        const span = lineSpanAt(model, lineIndex)
        if (!span) return
        const text = model.lines[lineIndex]?.text ?? ''
        open({ kind: 'line', lineIndex, endLine: lineIndex, start: 0, end: text.length, text })
      },
      editBlock: (lineIndex) => {
        const range = model.foldAt(lineIndex)
        const span = blockSpanAt(model, lineIndex)
        if (!span) return
        const endLine = range?.endLine ?? lineIndex
        const endText = model.lines[endLine]?.text ?? ''
        // A folded block would hide the very lines the editor is about to show.
        if (range && foldState.isFolded(range.startLine)) foldState.toggleFold(range.startLine)
        open({
          kind: 'block',
          lineIndex,
          endLine,
          start: 0,
          end: endText.length,
          text: spanText(span.start, span.end),
        })
      },
      commit: (text) => {
        setTarget(null)
        if (!target) return
        const start = offsetOfLine(model, target.lineIndex) + target.start
        const end = offsetOfLine(model, target.endLine) + target.end
        if (text === spanText(start, end)) return
        // A value edited in place keeps its line: re-flowing it would move text
        // the reader was not looking at. A line or block may be re-shaped.
        edit.apply(
          formattedEdit(
            model,
            { start, end, text },
            target.kind !== 'value',
            config.providers ?? undefined,
          ),
        )
      },
      cancel: () => setTarget(null),
      remove: (lineIndex) => {
        const removal = removeBlockEdit(model, lineIndex)
        if (!removal) return
        setTarget(null)
        edit.apply(removal)
      },
      duplicate: (lineIndex) => {
        const copy = duplicateBlockEdit(model, lineIndex)
        if (!copy) return
        edit.apply(copy.edit)
        // Straight into the editor on the copy: duplicating is how a new entry
        // is made here, and nobody wants two identical keys.
        open({
          kind: 'line',
          lineIndex: copy.line,
          endLine: copy.line,
          start: 0,
          end: copy.text.length,
          text: copy.text,
        })
      },
    }
  }, [editable, target, model, edit, foldState, config.providers])

  // A match may be inside a folded block and outside the rendered window, so
  // jumping to one opens whatever hides it and only then scrolls. The scroll
  // waits for the render that unfolding causes: until then the row it wants
  // does not exist.
  const [pendingLine, setPendingLine] = useState<number | null>(null)
  const revealLine = useCallback(
    (lineIndex: number) => {
      for (const range of model.foldingRanges) {
        if (range.startLine > lineIndex) break
        if (range.endLine >= lineIndex && foldState.isFolded(range.startLine)) {
          foldState.unfold(range.startLine)
        }
      }
      setPendingLine(lineIndex)
    },
    [model, foldState],
  )
  const reveal = useCallback((hit: SearchHit) => revealLine(hit.lineIndex), [revealLine])

  const search = useSearch({ kind: 'single', model }, reveal, resolvedLabels)

  // Zero-based inside, because everything else here is; one-based at the prop,
  // because that is the number a link carries.
  const selectedIndex = selectedLine !== undefined && selectedLine > 0 ? selectedLine - 1 : null

  // A link arriving is the same act as a search landing: open what hides the
  // line, then scroll to it. Keyed on the number rather than on a click, so
  // loading a page at `#L42` and clicking through to it behave alike.
  useEffect(() => {
    if (selectedIndex === null) return
    revealLine(selectedIndex)
  }, [selectedIndex, revealLine])

  const visibleLines = useMemo(
    () => visibleLinesOf(model, foldState.collapsed),
    [model, foldState.collapsed],
  )

  const rows = useMemo<RenderRow[]>(
    () => visibleLines.map((lineIndex) => ({ lineIndex, tone: 'normal' as const })),
    [visibleLines],
  )

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => config.lineHeight,
    overscan,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  useEffect(() => {
    if (pendingLine === null) return
    const row = visibleLines.indexOf(pendingLine)
    if (row >= 0) virtualizer.scrollToIndex(row, { align: 'center' })
    setPendingLine(null)
  }, [pendingLine, visibleLines, virtualizer])

  const contentColumns = useMemo(() => contentColumnsOf(model), [model])

  const lineSource = useMemo(
    () => ({
      side: 'single' as const,
      model,
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      scrollRef,
      labels: resolvedLabels,
      lineHeight: config.lineHeight,
      maxLineNumber: model.lines.length,
      contentColumns,
      isFolded: foldState.isFolded,
      toggleFold: foldState.toggleFold,
      foldAt: (lineIndex: number) => model.foldAt(lineIndex),
      search: {
        query: search.state.query,
        matchesAt: search.matchesAt,
        current: search.current,
      },
      selectedLine: selectedIndex,
      // Spread rather than assigned: with `exactOptionalPropertyTypes` an
      // optional field is absent or set, never explicitly `undefined`.
      ...(editing ? { editing } : {}),
      // The action only appears where someone is listening for it. A control
      // that reports a line nobody receives is a control that does nothing.
      ...(onSelectLine ? { selectLine: (lineIndex: number) => onSelectLine(lineIndex + 1) } : {}),
    }),
    [
      model,
      rows,
      virtualizer,
      virtualItems,
      totalSize,
      resolvedLabels,
      config.lineHeight,
      contentColumns,
      editing,
      foldState,
      search.state.query,
      search.matchesAt,
      search.current,
      selectedIndex,
      onSelectLine,
    ],
  )

  const viewerState = useMemo(
    () => ({
      ...foldState,
      model,
      visibleLines,
      labels: resolvedLabels,
      source: model.source,
      editable,
      canUndo: editable && edit.canUndo,
      canRedo: editable && edit.canRedo,
      undo: edit.undo,
      redo: edit.redo,
    }),
    [foldState, model, visibleLines, resolvedLabels, editable, edit],
  )

  const slots = useMemo(() => (children ? splitSlots(children, 'chrome') : null), [children])
  const chrome = slots
    ? slots.chrome
    : [
        ...(showSearch ? [<Search key="search" />] : []),
        ...(showDiagnostics ? [<Diagnostics key="diagnostics" />] : []),
      ]
  const canvas = slots ? slots.canvas : [<Gutter key="gutter" />, <Lines key="lines" />]

  return (
    <ViewerContext.Provider value={viewerState}>
      <SearchContext.Provider value={search.state}>
        <LineSourceContext.Provider value={lineSource}>
          <section
            className={className ? `krona-viewer ${className}` : 'krona-viewer'}
            style={style}
            aria-label={resolvedLabels.document}
          >
            {chrome}
            <div className="krona-scroll" ref={scrollRef}>
              <div className="krona-canvas" style={{ height: `${totalSize}px` }}>
                {canvas}
              </div>
            </div>
          </section>
        </LineSourceContext.Provider>
      </SearchContext.Provider>
    </ViewerContext.Provider>
  )
}
