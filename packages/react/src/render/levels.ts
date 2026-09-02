import type { DocumentModel } from '@kronajs/core'

/**
 * Depth of every line, as `aria-level` counts it: 1 at the top.
 *
 * A tree whose items are not nested in the DOM has to say how deep each one
 * sits, and Krona's rows are a flat, virtualized list — the nesting lives in
 * the folding ranges, not in the markup.
 *
 * Counted by difference array rather than by walking the ranges per line: a
 * range contributes a step down after the line that opens it and a step back
 * up after the line that closes it, so one pass over the ranges and one prefix
 * sum answer for the whole document. The line that opens a block therefore
 * reports the level of its parent, which is what it is — a `{` is the child,
 * its entries are the grandchildren.
 */
function computeLevels(model: DocumentModel): Int32Array {
  const count = model.lines.length
  const delta = new Int32Array(count + 1)
  for (const range of model.foldingRanges) {
    // Guarded because a provider reports ranges, and a range that ran off the
    // end of the document would corrupt every line after it rather than fail.
    const from = Math.min(range.startLine + 1, count)
    const to = Math.min(range.endLine + 1, count)
    if (from >= to) continue
    delta[from] = (delta[from] ?? 0) + 1
    delta[to] = (delta[to] ?? 0) - 1
  }
  const levels = new Int32Array(count)
  let depth = 0
  for (let line = 0; line < count; line++) {
    depth += delta[line] ?? 0
    levels[line] = depth + 1
  }
  return levels
}

// Keyed by the model, which is immutable: a new document is a new object, so
// the entry cannot go stale, and it disappears with the document it describes.
const cache = new WeakMap<DocumentModel, Int32Array>()

/** `aria-level` for one line, 1 at the top level. */
export function levelAt(model: DocumentModel, lineIndex: number): number {
  let levels = cache.get(model)
  if (!levels) {
    levels = computeLevels(model)
    cache.set(model, levels)
  }
  return levels[lineIndex] ?? 1
}
