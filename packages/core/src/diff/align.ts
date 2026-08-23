import type { DiffChange, DiffResult } from './myers'

/** How one side-by-side row should be painted. */
export type RowKind = 'equal' | 'changed' | 'added' | 'removed'

/**
 * One row of the side-by-side view. A `null` side is a spacer: the panel shows
 * blank space there so both panels stay vertically aligned.
 */
export interface AlignedRow {
  readonly kind: RowKind
  /** Left-hand line index, or `null` for a spacer. */
  readonly left: number | null
  /** Right-hand line index, or `null` for a spacer. */
  readonly right: number | null
}

/** Line counts by category, for a toolbar or summary. */
export interface DiffStats {
  readonly added: number
  readonly removed: number
  readonly changed: number
  readonly unchanged: number
}

/** Aligned rows plus their summary. */
export interface AlignedDiff {
  readonly rows: readonly AlignedRow[]
  readonly stats: DiffStats
  /** True when the underlying diff had to fall back to an approximation. */
  readonly approximate: boolean
}

/** Options for {@link alignDiff}. */
export interface AlignOptions {
  /**
   * Pair deleted and inserted lines that face each other into a single
   * `changed` row when they are similar enough. Default true.
   */
  readonly pairChanges?: boolean
  /**
   * Minimum similarity (0..1) for two facing lines to be paired. Below it they
   * are shown as a separate removal and addition, which reads better than a
   * "change" where nothing is recognisable. Default 0.3.
   */
  readonly pairThreshold?: number
}

const DEFAULT_PAIR_THRESHOLD = 0.3

/**
 * Turns a line diff into rows for two vertically aligned panels.
 *
 * @example
 * ```ts
 * const { rows, stats } = alignDiff(diffLines(before, after))
 * rows[0] // { kind: 'equal', left: 0, right: 0 }
 * ```
 */
export function alignDiff(result: DiffResult, options?: AlignOptions): AlignedDiff {
  const pairChanges = options?.pairChanges ?? true
  const threshold = options?.pairThreshold ?? DEFAULT_PAIR_THRESHOLD

  const rows: AlignedRow[] = []
  let added = 0
  let removed = 0
  let changed = 0
  let unchanged = 0

  const changes = result.changes
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i] as DiffChange

    if (change.op === 'equal') {
      for (let k = 0; k < change.count; k++) {
        rows.push({ kind: 'equal', left: change.leftStart + k, right: change.rightStart + k })
      }
      unchanged += change.count
      continue
    }

    if (change.op === 'insert') {
      for (let k = 0; k < change.count; k++) {
        rows.push({ kind: 'added', left: null, right: change.rightStart + k })
      }
      added += change.count
      continue
    }

    // A deletion directly followed by an insertion is a replacement; facing
    // lines are paired so the reader sees one modified row rather than a
    // removal far above its replacement.
    const next = changes[i + 1]
    const insertion = next?.op === 'insert' ? next : undefined
    if (!pairChanges || !insertion) {
      for (let k = 0; k < change.count; k++) {
        rows.push({ kind: 'removed', left: change.leftStart + k, right: null })
      }
      removed += change.count
      continue
    }

    i++
    const pairs = Math.min(change.count, insertion.count)
    let paired = 0
    for (; paired < pairs; paired++) {
      const leftIndex = change.leftStart + paired
      const rightIndex = insertion.rightStart + paired
      const similarity = similarityOf(result.left[leftIndex] ?? '', result.right[rightIndex] ?? '')
      if (similarity < threshold) break
      rows.push({ kind: 'changed', left: leftIndex, right: rightIndex })
      changed++
    }

    const restRemoved = change.count - paired
    const restAdded = insertion.count - paired
    for (let k = 0; k < restRemoved; k++) {
      rows.push({ kind: 'removed', left: change.leftStart + paired + k, right: null })
    }
    removed += restRemoved
    for (let k = 0; k < restAdded; k++) {
      rows.push({ kind: 'added', left: null, right: insertion.rightStart + paired + k })
    }
    added += restAdded
  }

  return { rows, stats: { added, removed, changed, unchanged }, approximate: result.approximate }
}

/**
 * Cheap similarity in `0..1` from the shared prefix and suffix of two lines.
 * Linear, allocation free, and good enough to tell "port 80 became port 443"
 * from "two unrelated lines happen to face each other".
 */
export function similarityOf(a: string, b: string): number {
  if (a === b) return 1
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  const shortest = Math.min(a.length, b.length)
  let prefix = 0
  while (prefix < shortest && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    a.charCodeAt(a.length - 1 - suffix) === b.charCodeAt(b.length - 1 - suffix)
  ) {
    suffix++
  }
  return (prefix + suffix) / longest
}

/** Row index of the first row on or after `from` whose kind is not `equal`. */
export function nextChangedRow(rows: readonly AlignedRow[], from: number): number {
  for (let i = Math.max(0, from); i < rows.length; i++) {
    if ((rows[i] as AlignedRow).kind !== 'equal') return i
  }
  return -1
}

/** Row index of the last row before `from` whose kind is not `equal`. */
export function previousChangedRow(rows: readonly AlignedRow[], from: number): number {
  for (let i = Math.min(rows.length, from) - 1; i >= 0; i--) {
    if ((rows[i] as AlignedRow).kind !== 'equal') return i
  }
  return -1
}
