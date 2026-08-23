import type { CollapsedRegion, DocumentModel, ExpandDirection, FoldRange, Span } from '@krona/core'
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual'
import { createContext, type RefObject, useContext } from 'react'
import type { KronaLabels } from '../labels'

/** Which side of a diff a line source represents. `'single'` in the viewer. */
export type LineSide = 'single' | 'left' | 'right'

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
  isFolded(startLine: number): boolean
  toggleFold(startLine: number): void
  foldAt(lineIndex: number): FoldRange | undefined
  /** Diff only: the hidden unchanged runs, indexed by region. */
  readonly regions?: readonly (CollapsedRegion | null)[]
  /** Diff only: reveals part of a hidden unchanged run. */
  expandContext?(regionIndex: number, direction: ExpandDirection, step?: number): void
  /** Diff only: rows revealed by one up / down click. */
  readonly step?: number
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
