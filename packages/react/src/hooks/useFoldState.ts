import type { DocumentModel } from '@krona/core'
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

function initialCollapsed(model: DocumentModel, depth: number | undefined): Set<number> {
  const collapsed = new Set<number>()
  if (depth === undefined) return collapsed
  for (const range of model.foldingRanges) {
    if (range.level >= depth) collapsed.add(range.startLine)
  }
  return collapsed
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
  const [collapsed, setCollapsed] = useState(() => initialCollapsed(model, defaultCollapsedDepth))
  const lastModel = useRef(model)

  // Deriving from props during render (rather than in an effect) avoids
  // rendering one frame of the previous document's folding.
  if (lastModel.current !== model) {
    lastModel.current = model
    setCollapsed(initialCollapsed(model, defaultCollapsedDepth))
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
    setCollapsed(new Set(model.foldingRanges.map((range) => range.startLine)))
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

/**
 * The line indices still visible once collapsed ranges are hidden.
 *
 * Walking the document once and jumping over each collapsed range keeps this
 * linear in the number of lines, with no per-line set lookups for nested
 * ranges that are hidden anyway.
 */
export function computeVisibleLines(
  model: DocumentModel,
  collapsed: ReadonlySet<number>,
): number[] {
  const visible: number[] = []
  const total = model.lines.length
  let i = 0
  while (i < total) {
    visible.push(i)
    if (collapsed.size > 0 && collapsed.has(i)) {
      const range = model.foldAt(i)
      if (range) {
        i = range.endLine + 1
        continue
      }
    }
    i++
  }
  return visible
}
