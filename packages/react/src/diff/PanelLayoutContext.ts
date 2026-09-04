import type {
  AlignedRow,
  CollapsedRegion,
  DisplayItem,
  DocumentModel,
  ExpandDirection,
  IntralineResult,
  RowIndex,
} from '@kronajs/core'
import { createContext, useContext } from 'react'
import type { LineSearch } from '../context/lineSource'
import type { ScrollSync } from '../hooks/useScrollSync'
import type { KronaLabels } from '../labels'

/**
 * Everything a `Krona.Panel` needs to render one side. Kept apart from the
 * public diff state so that scrolling or folding does not re-render consumers
 * of `useKronaDiff()` that only care about the statistics.
 */
export interface PanelLayout {
  readonly displayItems: readonly DisplayItem[]
  readonly alignedRows: readonly AlignedRow[]
  readonly leftModel: DocumentModel
  readonly rightModel: DocumentModel
  readonly rowIndex: RowIndex
  readonly collapsedRows: ReadonlySet<number>
  readonly regions: readonly (CollapsedRegion | null)[]
  toggleRowFold(row: number): void
  expandContext(regionIndex: number, direction: ExpandDirection, step?: number): void
  getIntraline(row: number): IntralineResult
  readonly labels: KronaLabels
  readonly lineHeight: number
  readonly overscan: number
  readonly scrollSync: ScrollSync
  readonly step: number
  /** What a search wants painted on the lines, if one is open. */
  readonly search: LineSearch
  /** Row a jump asked for, once the fold and the collapsed run hiding it are open. */
  /**
   * The aligned row a link points at, or null. A row rather than a line: the
   * two panels must come to rest on the same comparison, and each shows its own
   * side of it.
   */
  readonly selectedRow: number | null
  /** Present when the host wants to hear which line was picked. */
  readonly selectLine?: (lineIndex: number, side: 'left' | 'right') => void
  readonly pendingRow: number | null
  clearPendingRow(): void
}

export const PanelLayoutContext = createContext<PanelLayout | null>(null)

/** @throws if a panel is rendered outside `<Krona.Diff>`. */
export function usePanelLayout(): PanelLayout {
  const layout = useContext(PanelLayoutContext)
  if (!layout) {
    throw new Error('Krona: <Krona.Panel> must be rendered inside <Krona.Diff>.')
  }
  return layout
}
