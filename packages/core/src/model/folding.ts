import type { DocumentModel } from './types'

/**
 * Start lines of every range at or below a nesting depth.
 *
 * The seed a viewer opens with: `collapsedToDepth(model, 1)` shows the top
 * level and folds everything under it. `undefined` collapses nothing, which is
 * a different answer from `0` — zero folds even the outermost range.
 */
export function collapsedToDepth(model: DocumentModel, depth: number | undefined): Set<number> {
  const collapsed = new Set<number>()
  if (depth === undefined) return collapsed
  for (const range of model.foldingRanges) {
    if (range.level >= depth) collapsed.add(range.startLine)
  }
  return collapsed
}

/** Start lines of every folding range, i.e. the document fully folded. */
export function allCollapsed(model: DocumentModel): Set<number> {
  return new Set(model.foldingRanges.map((range) => range.startLine))
}

/**
 * The line indices still on screen once the collapsed ranges are hidden.
 *
 * Walks the document once and jumps over each collapsed range, so it stays
 * linear in the number of lines with no per-line set lookups for the nested
 * ranges that are hidden anyway.
 */
export function visibleLines(model: DocumentModel, collapsed: ReadonlySet<number>): number[] {
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

/**
 * Nesting depth of every line, 1 at the top level.
 *
 * Counted by difference array rather than by walking the ranges per line: a
 * range steps the depth down after the line that opens it and back up after
 * the line that closes it, so one pass over the ranges and one prefix sum
 * answer for the whole document.
 *
 * A line that opens a block reports the depth of its parent, which is what it
 * is — a `{` is the child, and the entries inside it are the grandchildren.
 */
function computeLevels(model: DocumentModel): Int32Array {
  const count = model.lines.length
  const delta = new Int32Array(count + 1)
  for (const range of model.foldingRanges) {
    // Guarded because a range is reported by a provider, and one that ran off
    // the end of the document would corrupt every line after it rather than
    // fail where the mistake was made.
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
// the entry cannot go stale, and it is collected with the document it describes.
const cache = new WeakMap<DocumentModel, Int32Array>()

/**
 * How deeply one line is nested, 1 at the top level.
 *
 * A view that lays the document out as a flat list — which any virtualized one
 * must — has no nesting in its markup to read this from, and a reader still
 * needs to be told. Memoized per document, so asking line by line costs one
 * pass in total.
 */
export function nestingLevelAt(model: DocumentModel, lineIndex: number): number {
  let levels = cache.get(model)
  if (!levels) {
    levels = computeLevels(model)
    cache.set(model, levels)
  }
  return levels[lineIndex] ?? 1
}
