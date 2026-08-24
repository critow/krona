import { diffArrays } from 'diff'
import { splitLines } from '../model/lines'
import { anchoredDiff, mergeChanges } from './anchor'

/** How a run of lines relates the two sides. */
export type DiffOp = 'equal' | 'insert' | 'delete'

/** A run of consecutive lines with the same relationship between the sides. */
export interface DiffChange {
  readonly op: DiffOp
  /** First left-hand line index the run covers (`equal` and `delete`). */
  readonly leftStart: number
  /** First right-hand line index the run covers (`equal` and `insert`). */
  readonly rightStart: number
  readonly count: number
}

/** Result of a line-level diff. */
export interface DiffResult {
  readonly left: readonly string[]
  readonly right: readonly string[]
  readonly changes: readonly DiffChange[]
  /**
   * True when the exact algorithm hit its time budget and a coarse
   * prefix/suffix approximation was returned instead.
   */
  readonly approximate: boolean
}

/** Options for {@link diffLines}. */
export interface LineDiffOptions {
  /**
   * Milliseconds the exact algorithm may spend before falling back to a coarse
   * result. Myers is O(ND); two large, wholly unrelated files are the
   * pathological case, so the budget is a hard requirement rather than a knob.
   * Default 1500.
   */
  readonly timeout?: number
  /** Compare lines ignoring trailing whitespace. Default false. */
  readonly ignoreTrailingWhitespace?: boolean
  /**
   * `'anchored'` (default) splits the documents at lines that occur exactly
   * once on each side before running Myers inside each piece — much faster on
   * large files with many changes, and it anchors on the lines a reader would.
   * `'myers'` runs the plain algorithm over the whole document.
   */
  readonly strategy?: 'anchored' | 'myers'
}

const DEFAULT_TIMEOUT = 1500

function trimEnd(value: string): string {
  let end = value.length
  while (end > 0) {
    const c = value.charCodeAt(end - 1)
    if (c !== 32 && c !== 9 && c !== 13) break
    end--
  }
  return value.slice(0, end)
}

/**
 * Diffs two documents line by line.
 *
 * The comparison is textual, exactly like git: reordering keys or reindenting a
 * block *is* a difference, and Krona shows it as one. That is deliberate — a
 * semantic diff would hide changes that matter in a configuration file.
 *
 * @example
 * ```ts
 * const result = diffLines('a\nb\n', 'a\nc\n')
 * result.changes // [{ op: 'equal', ... }, { op: 'delete', ... }, { op: 'insert', ... }]
 * ```
 */
export function diffLines(left: string, right: string, options?: LineDiffOptions): DiffResult {
  return diffLineArrays(splitLines(left), splitLines(right), options)
}

/** Same as {@link diffLines} but for already split documents. */
export function diffLineArrays(
  left: readonly string[],
  right: readonly string[],
  options?: LineDiffOptions,
): DiffResult {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT
  const compareLeft = options?.ignoreTrailingWhitespace ? left.map(trimEnd) : left
  const compareRight = options?.ignoreTrailingWhitespace ? right.map(trimEnd) : right

  const deadline = Date.now() + timeout
  if ((options?.strategy ?? 'anchored') === 'anchored') {
    const anchored = anchoredDiff(compareLeft, compareRight, deadline)
    return anchored === undefined
      ? { left, right, changes: approximate(compareLeft, compareRight), approximate: true }
      : { left, right, changes: anchored, approximate: false }
  }

  const raw = diffArrays<string>([...compareLeft], [...compareRight], { timeout })
  if (raw === undefined) {
    return { left, right, changes: approximate(compareLeft, compareRight), approximate: true }
  }

  const changes: DiffChange[] = []
  let leftIndex = 0
  let rightIndex = 0
  for (const part of raw) {
    const count = part.count ?? part.value.length
    if (count === 0) continue
    if (part.added) {
      changes.push({ op: 'insert', leftStart: leftIndex, rightStart: rightIndex, count })
      rightIndex += count
    } else if (part.removed) {
      changes.push({ op: 'delete', leftStart: leftIndex, rightStart: rightIndex, count })
      leftIndex += count
    } else {
      changes.push({ op: 'equal', leftStart: leftIndex, rightStart: rightIndex, count })
      leftIndex += count
      rightIndex += count
    }
  }
  return { left, right, changes: mergeChanges(changes), approximate: false }
}

/**
 * Coarse fallback used when the exact diff runs out of time: keep the common
 * prefix and suffix, and call everything between them one replacement. It is
 * always correct, just less minimal — the same trade git makes when its own
 * heuristics give up.
 */
function approximate(left: readonly string[], right: readonly string[]): DiffChange[] {
  const max = Math.min(left.length, right.length)
  let prefix = 0
  while (prefix < max && left[prefix] === right[prefix]) prefix++

  let suffix = 0
  while (
    suffix < max - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) {
    suffix++
  }

  const changes: DiffChange[] = []
  if (prefix > 0) changes.push({ op: 'equal', leftStart: 0, rightStart: 0, count: prefix })

  const removed = left.length - suffix - prefix
  const added = right.length - suffix - prefix
  if (removed > 0) {
    changes.push({ op: 'delete', leftStart: prefix, rightStart: prefix, count: removed })
  }
  if (added > 0) {
    changes.push({ op: 'insert', leftStart: prefix + removed, rightStart: prefix, count: added })
  }
  if (suffix > 0) {
    changes.push({
      op: 'equal',
      leftStart: left.length - suffix,
      rightStart: right.length - suffix,
      count: suffix,
    })
  }
  return changes
}
