import type {
  AlignedRow,
  CollapsedRegion,
  DiffStats,
  DocumentModel,
  ExpandDirection,
} from '@krona/core'
import { createContext, useContext } from 'react'
import type { KronaLabels } from '../labels'

/** State exposed by {@link useKronaDiff}. */
export interface KronaDiffState {
  readonly left: DocumentModel
  readonly right: DocumentModel
  /** Every aligned row, including the ones currently hidden. */
  readonly alignedRows: readonly AlignedRow[]
  /** Row indices still visible after folding and unchanged-run collapsing. */
  readonly visibleRows: readonly number[]
  readonly stats: DiffStats
  /** True when the diff fell back to an approximation because of its time budget. */
  readonly approximate: boolean
  /** Runs of unchanged rows currently hidden behind an expand bar. */
  readonly collapsedRegions: readonly CollapsedRegion[]
  /** Reveals part (or all) of a hidden run. */
  expandContext(regionIndex: number, direction: ExpandDirection, step?: number): void
  /** Row indices whose folding range is collapsed, shared by both panels. */
  readonly collapsed: ReadonlySet<number>
  isRowFolded(rowIndex: number): boolean
  toggleRowFold(rowIndex: number): void
  expandAll(): void
  collapseAll(): void
  readonly labels: KronaLabels
  /**
   * True while the diff shows one panel at a time, because the root is narrower
   * than its `narrowWidth`. Two panels on a phone are two unreadable panels.
   */
  readonly narrow: boolean
  /** The side on screen while {@link KronaDiffState.narrow}. */
  readonly side: 'left' | 'right'
  /** Switches which side a narrow layout shows. */
  showSide(side: 'left' | 'right'): void
}

export const DiffContext = createContext<KronaDiffState | null>(null)

/**
 * Diff state, for custom toolbars, change navigation and integrations.
 *
 * @example
 * ```tsx
 * function ChangeCount() {
 *   const { stats } = useKronaDiff()
 *   return <span>{stats.added} added, {stats.removed} removed</span>
 * }
 * ```
 *
 * @throws if called outside a `<Krona.Diff>`.
 */
export function useKronaDiff(): KronaDiffState {
  const state = useContext(DiffContext)
  if (!state) {
    throw new Error('Krona: useKronaDiff() must be called inside <Krona.Diff>.')
  }
  return state
}
