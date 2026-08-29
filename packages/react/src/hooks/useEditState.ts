import { applyEdit, type SourceEdit } from '@kronajs/core'
import { useCallback, useMemo, useRef, useState } from 'react'

/** Editing history and current text, as `Krona.Viewer` keeps them. */
export interface EditState {
  /** The document as it stands after every applied edit. */
  readonly source: string
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Applies an edit and returns the resulting source. */
  apply(edit: SourceEdit): string
  undo(): void
  redo(): void
}

interface History {
  readonly source: string
  readonly undo: readonly SourceEdit[]
  readonly redo: readonly SourceEdit[]
}

const EMPTY: readonly SourceEdit[] = []

/**
 * Keeps the edited text and its undo history.
 *
 * The history holds inverse edits rather than document snapshots: undoing a
 * hundred changes to a megabyte file costs a hundred short strings instead of a
 * hundred megabytes, and every step is exact, because it is the very span that
 * changed.
 *
 * The state re-seeds whenever `initial` changes, so a viewer handed new text
 * shows the new text rather than the edits made to the old one.
 */
export function useEditState(initial: string, onChange?: (source: string) => void): EditState {
  const fresh = (source: string): History => ({ source, undo: EMPTY, redo: EMPTY })
  const [history, setHistory] = useState<History>(() => fresh(initial))
  const seed = useRef(initial)
  // Mirrors the state for the callbacks. A commit has to know its result
  // immediately — it reports it through `onChange` — and state updates land
  // after the render, so the updater is never the place to read from.
  const live = useRef(history)

  if (seed.current !== initial) {
    seed.current = initial
    live.current = fresh(initial)
    setHistory(live.current)
  } else {
    live.current = history
  }

  const change = useRef(onChange)
  change.current = onChange

  const commit = useCallback((next: History) => {
    live.current = next
    setHistory(next)
    change.current?.(next.source)
  }, [])

  const apply = useCallback(
    (edit: SourceEdit): string => {
      const current = live.current
      const applied = applyEdit(current.source, edit)
      // A fresh edit ends the redo branch, the way every editor does it.
      commit({ source: applied.source, undo: [...current.undo, applied.inverse], redo: EMPTY })
      return applied.source
    },
    [commit],
  )

  const undo = useCallback(() => {
    const current = live.current
    const edit = current.undo[current.undo.length - 1]
    if (!edit) return
    const applied = applyEdit(current.source, edit)
    commit({
      source: applied.source,
      undo: current.undo.slice(0, -1),
      redo: [...current.redo, applied.inverse],
    })
  }, [commit])

  const redo = useCallback(() => {
    const current = live.current
    const edit = current.redo[current.redo.length - 1]
    if (!edit) return
    const applied = applyEdit(current.source, edit)
    commit({
      source: applied.source,
      undo: [...current.undo, applied.inverse],
      redo: current.redo.slice(0, -1),
    })
  }, [commit])

  return useMemo(
    () => ({
      source: history.source,
      canUndo: history.undo.length > 0,
      canRedo: history.redo.length > 0,
      apply,
      undo,
      redo,
    }),
    [history, apply, undo, redo],
  )
}
