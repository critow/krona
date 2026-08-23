import type {
  AlignedRow,
  CollapsedRegion,
  DocumentModel,
  ExpandDirection,
  IntralineResult,
} from '@krona/core'
import { createContext, useContext } from 'react'
import type { ScrollSync } from '../hooks/useScrollSync'
import type { KronaLabels } from '../labels'
import type { DisplayItem, RowIndex } from './rows'

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
