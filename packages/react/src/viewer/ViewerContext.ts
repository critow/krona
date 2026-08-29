import type { DocumentModel } from '@kronajs/core'
import { createContext, useContext } from 'react'
import type { FoldState } from '../hooks/useFoldState'
import type { KronaLabels } from '../labels'

/** State exposed by {@link useKronaViewer}. */
export interface KronaViewerState extends FoldState {
  readonly model: DocumentModel
  /** Line indices currently visible, after folding. */
  readonly visibleLines: readonly number[]
  readonly labels: KronaLabels
  /** The document as it stands, including every edit made so far. */
  readonly source: string
  /** True when the viewer was given `editable`. */
  readonly editable: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Reverses the last edit. A no-op when there is nothing to undo. */
  undo(): void
  /** Replays the last undone edit. A no-op when there is nothing to redo. */
  redo(): void
}

export const ViewerContext = createContext<KronaViewerState | null>(null)

/**
 * Viewer state, for custom toolbars and integrations outside the built-in parts.
 *
 * @example
 * ```tsx
 * function MyToolbar() {
 *   const { model, collapseAll } = useKronaViewer()
 *   return <button onClick={collapseAll}>Collapse {model.foldingRanges.length}</button>
 * }
 * ```
 *
 * @throws if called outside a `<Krona.Viewer>`.
 */
export function useKronaViewer(): KronaViewerState {
  const state = useContext(ViewerContext)
  if (!state) {
    throw new Error('Krona: useKronaViewer() must be called inside <Krona.Viewer>.')
  }
  return state
}
