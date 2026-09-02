import {
  type EditHistory,
  emptyHistory,
  type SourceEdit,
  withEdit,
  withRedo,
  withUndo,
} from '@kronajs/core'
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
  const [history, setHistory] = useState<EditHistory>(() => emptyHistory(initial))
  const seed = useRef(initial)
  // Mirrors the state for the callbacks. A commit has to know its result
  // immediately — it reports it through `onChange` — and state updates land
  // after the render, so the updater is never the place to read from.
  const live = useRef(history)

  if (seed.current !== initial) {
    seed.current = initial
    live.current = emptyHistory(initial)
    setHistory(live.current)
  } else {
    live.current = history
  }

  const change = useRef(onChange)
  change.current = onChange

  const commit = useCallback((next: EditHistory) => {
    live.current = next
    setHistory(next)
    change.current?.(next.source)
  }, [])

  const apply = useCallback(
    (edit: SourceEdit): string => {
      const next = withEdit(live.current, edit)
      commit(next)
      return next.source
    },
    [commit],
  )

  // The transitions answer with the very history they were given when there is
  // nowhere to go, so a dead key press costs no render.
  const undo = useCallback(() => {
    const next = withUndo(live.current)
    if (next !== live.current) commit(next)
  }, [commit])

  const redo = useCallback(() => {
    const next = withRedo(live.current)
    if (next !== live.current) commit(next)
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
