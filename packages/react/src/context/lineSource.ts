import type { CollapsedRegion, DocumentModel, ExpandDirection, FoldRange, Span } from '@krona/core'
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual'
import { createContext, type RefObject, useContext } from 'react'
import type { KronaLabels } from '../labels'

/**
 * Which side of a diff a line source represents. `'single'` in the viewer, and
 * `'unified'` where one column carries rows from both versions.
 */
export type LineSide = 'single' | 'left' | 'right' | 'unified'

/** How a row should be painted. */
export type RowTone = 'normal' | 'added' | 'removed' | 'changed' | 'spacer'

/** One row as the parts see it, after folding and diff alignment. */
export interface RenderRow {
  /** Line index in this side's document, or `null` for an alignment spacer. */
  readonly lineIndex: number | null
  readonly tone: RowTone
  /** Character ranges to highlight inside the line (word-level diff). */
  readonly intraline?: readonly Span[]
  /** True when the whole line should read as changed rather than parts of it. */
  readonly wholeLine?: boolean
  /**
   * Set when this row stands in for a hidden run of unchanged diff rows; the
   * parts render an expand bar instead of a line.
   */
  readonly expandRegion?: number
  /**
   * The document this row's line comes from, when it is not the source's own.
   * Only a unified diff sets it: there, consecutive rows come from the two
   * versions, and a row has to say which one it read.
   */
  readonly model?: DocumentModel
  /**
   * The version this row was taken from, in a unified diff. Folding is keyed by
   * side as well as line: line 12 of the old file and line 12 of the new one
   * are different lines, and can open different ranges.
   */
  readonly side?: 'left' | 'right'
}

/**
 * Everything a part (`Gutter`, `Lines`, …) needs in order to render, with no
 * knowledge of whether it lives in a `Krona.Viewer` or in one panel of a
 * `Krona.Diff`. The viewer provides this itself; in a diff each `Krona.Panel`
 * provides it for its own side.
 */
export interface LineSource {
  readonly side: LineSide
  readonly model: DocumentModel
  readonly rows: readonly RenderRow[]
  readonly virtualizer: Virtualizer<HTMLDivElement, Element>
  /**
   * The rows to render this frame. They live in context rather than being read
   * from the virtualizer inside each part, so memoized parts re-render when the
   * viewport moves and stay still when it does not.
   */
  readonly virtualItems: readonly VirtualItem[]
  /** Height of the full, unvirtualized content in pixels. */
  readonly totalSize: number
  readonly scrollRef: RefObject<HTMLDivElement | null>
  readonly labels: KronaLabels
  readonly lineHeight: number
  /** Widest line number, used to size the gutter without measuring the DOM. */
  readonly maxLineNumber: number
  /**
   * Width to reserve for the document, in characters. In a diff both panels get
   * the same number, so the two sides scroll horizontally to the same column.
   */
  readonly contentColumns: number
  /**
   * `side` is only meaningful in a unified diff, where a line index alone does
   * not name a line. Elsewhere the source has one document and ignores it.
   */
  isFolded(startLine: number, side?: 'left' | 'right'): boolean
  toggleFold(startLine: number, side?: 'left' | 'right'): void
  foldAt(lineIndex: number, side?: 'left' | 'right'): FoldRange | undefined
  /** Diff only: the hidden unchanged runs, indexed by region. */
  readonly regions?: readonly (CollapsedRegion | null)[]
  /** Diff only: reveals part of a hidden unchanged run. */
  expandContext?(regionIndex: number, direction: ExpandDirection, step?: number): void
  /** Diff only: rows revealed by one up / down click. */
  readonly step?: number
  /** Viewer only, and only when `editable`: the editing operations. */
  readonly editing?: LineEditing
  /** Present while a search is open: what to paint on each line. */
  readonly search?: LineSearch
}

/** The search, as the parts that paint it see it. */
export interface LineSearch {
  readonly query: string
  /** Columns to highlight on a line of this source's document. */
  matchesAt(lineIndex: number, side?: 'left' | 'right'): readonly Span[]
  /** The one match the reader is standing on, wherever it is. */
  readonly current: {
    readonly side: 'single' | 'left' | 'right'
    readonly lineIndex: number
    readonly start: number
    readonly end: number
  } | null
}

/** What an open inline editor covers. */
export interface EditTarget {
  /** `'value'` edits one value in place; `'line'` and `'block'` edit raw text. */
  readonly kind: 'value' | 'line' | 'block'
  readonly lineIndex: number
  /** Last line covered. Equal to `lineIndex` unless a whole block is open. */
  readonly endLine: number
  /** Line-relative start column on `lineIndex`. */
  readonly start: number
  /** Line-relative end column on `endLine`. */
  readonly end: number
  /** Text the editor opens with. */
  readonly text: string
}

/**
 * Editing operations, present on the line source only where editing is enabled.
 *
 * Every operation is a text edit against the document's source, which is then
 * re-parsed. Nothing writes back through a JavaScript object, so an edit cannot
 * invent syntax the format does not have — it only moves characters the reader
 * typed.
 */
export interface LineEditing {
  /** The open editor, or `null` when nothing is being edited. */
  readonly target: EditTarget | null
  /** Opens an editor over one value, at line-relative columns. */
  editValue(lineIndex: number, start: number, end: number): void
  /** Opens an editor over the whole line, as raw text. */
  editLine(lineIndex: number): void
  /** Opens an editor over the whole block opening on this line, as raw text. */
  editBlock(lineIndex: number): void
  /** Replaces the open editor's span with this text and closes it. */
  commit(text: string): void
  /** Closes the editor, changing nothing. */
  cancel(): void
  /** Removes the block opening on this line, or the line itself. */
  remove(lineIndex: number): void
  /** Repeats the entry below itself and opens the copy for editing. */
  duplicate(lineIndex: number): void
}

export const LineSourceContext = createContext<LineSource | null>(null)

/**
 * Reads the nearest line source.
 *
 * @throws if the part is not inside a `Krona.Viewer` or a `Krona.Panel`.
 */
export function useLineSource(): LineSource {
  const source = useContext(LineSourceContext)
  if (!source) {
    throw new Error('Krona: this part must be rendered inside <Krona.Viewer> or <Krona.Panel>.')
  }
  return source
}
