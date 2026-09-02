import { allCollapsed, collapsedToDepth, type DocumentModel } from '@kronajs/core'
import { useCallback, useMemo, useRef, useState } from 'react'

/** Imperative handle over the set of collapsed folding ranges. */
export interface FoldState {
  /** Start lines of the currently collapsed ranges. */
  readonly collapsed: ReadonlySet<number>
  isFolded(startLine: number): boolean
  toggleFold(startLine: number): void
  fold(startLine: number): void
  unfold(startLine: number): void
  expandAll(): void
  collapseAll(): void
}

/**
 * Folding state for one document, keyed by the start line of each range.
 *
 * The state resets whenever the model identity changes, so loading a different
 * file does not leave stale line numbers collapsed.
 */
export function useFoldState(
  model: DocumentModel,
  defaultCollapsedDepth: number | undefined,
): FoldState {
  const [collapsed, setCollapsed] = useState(() => collapsedToDepth(model, defaultCollapsedDepth))
  const lastSeed = useRef({ model, depth: defaultCollapsedDepth })

  // Deriving from props during render (rather than in an effect) avoids
  // rendering one frame of the previous document's folding. The depth is part
  // of the seed so that changing it re-applies, the way the diff already
  // behaves — the two modes reading the same prop differently is worse than
  // either rule on its own.
  if (lastSeed.current.model !== model || lastSeed.current.depth !== defaultCollapsedDepth) {
    lastSeed.current = { model, depth: defaultCollapsedDepth }
    setCollapsed(collapsedToDepth(model, defaultCollapsedDepth))
  }

  const fold = useCallback((startLine: number) => {
    setCollapsed((current) => {
      if (current.has(startLine)) return current
      const next = new Set(current)
      next.add(startLine)
      return next
    })
  }, [])

  const unfold = useCallback((startLine: number) => {
    setCollapsed((current) => {
      if (!current.has(startLine)) return current
      const next = new Set(current)
      next.delete(startLine)
      return next
    })
  }, [])

  const toggleFold = useCallback((startLine: number) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(startLine)) next.add(startLine)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setCollapsed((current) => (current.size === 0 ? current : new Set()))
  }, [])

  const collapseAll = useCallback(() => {
    setCollapsed(allCollapsed(model))
  }, [model])

  return useMemo(
    () => ({
      collapsed,
      isFolded: (startLine: number) => collapsed.has(startLine),
      toggleFold,
      fold,
      unfold,
      expandAll,
      collapseAll,
    }),
    [collapsed, toggleFold, fold, unfold, expandAll, collapseAll],
  )
}
