import type { SourceEdit } from './edit'
import { applyEdit } from './edit'

/** Edited text with the edits that would take it back and forward again. */
export interface EditHistory {
  /** The document as it stands after every applied edit. */
  readonly source: string
  /** Inverse edits, oldest first: the last one undoes the last change. */
  readonly undo: readonly SourceEdit[]
  /** Inverse edits of what was undone, oldest first. */
  readonly redo: readonly SourceEdit[]
}

const NONE: readonly SourceEdit[] = []

/** A history holding nothing but the text it starts from. */
export function emptyHistory(source: string): EditHistory {
  return { source, undo: NONE, redo: NONE }
}

/**
 * The history after one more edit.
 *
 * What is kept is the inverse edit, not a copy of the document: undoing a
 * hundred changes to a megabyte file costs a hundred short strings rather than
 * a hundred megabytes, and every step is exact, because it is the very span
 * that changed.
 *
 * A fresh edit ends the redo branch, the way every editor does it.
 */
export function withEdit(history: EditHistory, edit: SourceEdit): EditHistory {
  const applied = applyEdit(history.source, edit)
  return { source: applied.source, undo: [...history.undo, applied.inverse], redo: NONE }
}

/** The history one step back, or the same one when there is nothing to undo. */
export function withUndo(history: EditHistory): EditHistory {
  const edit = history.undo[history.undo.length - 1]
  if (!edit) return history
  const applied = applyEdit(history.source, edit)
  return {
    source: applied.source,
    undo: history.undo.slice(0, -1),
    redo: [...history.redo, applied.inverse],
  }
}

/** The history one step forward, or the same one when there is nothing to redo. */
export function withRedo(history: EditHistory): EditHistory {
  const edit = history.redo[history.redo.length - 1]
  if (!edit) return history
  const applied = applyEdit(history.source, edit)
  return {
    source: applied.source,
    undo: [...history.undo, applied.inverse],
    redo: history.redo.slice(0, -1),
  }
}
