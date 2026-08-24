import { diffArrays } from 'diff'
import type { DiffChange } from './myers'

/**
 * Anchoring pass in front of Myers.
 *
 * Myers is O(ND): on two versions of a 60k-line lockfile, where thousands of
 * lines differ, D is large enough to cost seconds. Splitting the problem at
 * lines that occur exactly once on each side — the idea behind patience diff —
 * turns one huge edit-distance problem into many tiny ones, and as a bonus the
 * result reads better, because it anchors on the lines a human would.
 *
 * Myers still does the work inside each segment; this only decides where the
 * segments are.
 */

interface Segment {
  readonly leftStart: number
  readonly leftEnd: number
  readonly rightStart: number
  readonly rightEnd: number
}

type Task = { kind: 'emit'; change: DiffChange } | { kind: 'split'; segment: Segment }

/** Segments at or below this size go straight to Myers; anchoring cannot pay off. */
const MIN_SEGMENT = 6

interface Occurrence {
  leftCount: number
  leftIndex: number
  rightCount: number
  rightIndex: number
}

/**
 * Pairs of positions whose line is unique on both sides, in an order that is
 * increasing on both — the longest such chain, found with patience sorting.
 */
function findAnchors(
  left: readonly string[],
  right: readonly string[],
  segment: Segment,
): Array<[number, number]> {
  const seen = new Map<string, Occurrence>()
  for (let i = segment.leftStart; i < segment.leftEnd; i++) {
    const line = left[i] as string
    const entry = seen.get(line)
    if (entry) {
      entry.leftCount++
    } else {
      seen.set(line, { leftCount: 1, leftIndex: i, rightCount: 0, rightIndex: -1 })
    }
  }
  for (let i = segment.rightStart; i < segment.rightEnd; i++) {
    const entry = seen.get(right[i] as string)
    if (!entry) continue
    entry.rightCount++
    if (entry.rightCount === 1) entry.rightIndex = i
  }

  const candidates: Array<[number, number]> = []
  for (const entry of seen.values()) {
    if (entry.leftCount === 1 && entry.rightCount === 1) {
      candidates.push([entry.leftIndex, entry.rightIndex])
    }
  }
  if (candidates.length === 0) return candidates
  candidates.sort((a, b) => a[0] - b[0])

  // Longest increasing subsequence by right index, so the anchors never cross.
  const tailIndex: number[] = []
  const previous = new Int32Array(candidates.length).fill(-1)
  for (let i = 0; i < candidates.length; i++) {
    const value = (candidates[i] as [number, number])[1]
    let lo = 0
    let hi = tailIndex.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const at = tailIndex[mid] as number
      if (((candidates[at] as [number, number])[1] ?? 0) < value) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) previous[i] = tailIndex[lo - 1] as number
    tailIndex[lo] = i
  }

  const chain: Array<[number, number]> = []
  let cursor = tailIndex.length > 0 ? (tailIndex[tailIndex.length - 1] as number) : -1
  while (cursor >= 0) {
    chain.push(candidates[cursor] as [number, number])
    cursor = previous[cursor] as number
  }
  chain.reverse()
  return chain
}

function myersSegment(
  left: readonly string[],
  right: readonly string[],
  segment: Segment,
  timeout: number,
): DiffChange[] | undefined {
  const leftSlice = left.slice(segment.leftStart, segment.leftEnd)
  const rightSlice = right.slice(segment.rightStart, segment.rightEnd)
  const parts = diffArrays<string>(leftSlice, rightSlice, { timeout })
  if (parts === undefined) return undefined

  const changes: DiffChange[] = []
  let leftAt = segment.leftStart
  let rightAt = segment.rightStart
  for (const part of parts) {
    const count = part.count ?? part.value.length
    if (count === 0) continue
    if (part.added) {
      changes.push({ op: 'insert', leftStart: leftAt, rightStart: rightAt, count })
      rightAt += count
    } else if (part.removed) {
      changes.push({ op: 'delete', leftStart: leftAt, rightStart: rightAt, count })
      leftAt += count
    } else {
      changes.push({ op: 'equal', leftStart: leftAt, rightStart: rightAt, count })
      leftAt += count
      rightAt += count
    }
  }
  return changes
}

/** Joins neighbouring runs with the same operation into one change. */
export function mergeChanges(changes: readonly DiffChange[]): DiffChange[] {
  const out: DiffChange[] = []
  for (const change of changes) {
    if (change.count === 0) continue
    const last = out[out.length - 1]
    if (last && last.op === change.op) {
      out[out.length - 1] = { ...last, count: last.count + change.count }
      continue
    }
    out.push(change)
  }
  return out
}

/**
 * Diffs two documents by splitting them at unique common lines and running
 * Myers inside each piece.
 *
 * Returns `undefined` when the time budget runs out, so the caller can fall
 * back to a coarse approximation.
 *
 * The traversal is iterative: a task stack, not recursion, keeps a pathological
 * file from overflowing the stack.
 */
export function anchoredDiff(
  left: readonly string[],
  right: readonly string[],
  deadline: number,
): DiffChange[] | undefined {
  const changes: DiffChange[] = []
  const stack: Task[] = [
    {
      kind: 'split',
      segment: { leftStart: 0, leftEnd: left.length, rightStart: 0, rightEnd: right.length },
    },
  ]

  while (stack.length > 0) {
    const task = stack.pop() as Task
    if (task.kind === 'emit') {
      changes.push(task.change)
      continue
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) return undefined

    let { leftStart, leftEnd, rightStart, rightEnd } = task.segment
    const pending: Task[] = []

    // Common prefix and suffix are free equalities; peeling them keeps the
    // anchor search and Myers focused on what actually differs.
    let prefix = 0
    while (
      leftStart + prefix < leftEnd &&
      rightStart + prefix < rightEnd &&
      left[leftStart + prefix] === right[rightStart + prefix]
    ) {
      prefix++
    }
    if (prefix > 0) {
      pending.push({
        kind: 'emit',
        change: { op: 'equal', leftStart, rightStart, count: prefix },
      })
      leftStart += prefix
      rightStart += prefix
    }

    let suffix = 0
    while (
      leftEnd - suffix > leftStart &&
      rightEnd - suffix > rightStart &&
      left[leftEnd - suffix - 1] === right[rightEnd - suffix - 1]
    ) {
      suffix++
    }
    const suffixTask: Task | undefined =
      suffix > 0
        ? {
            kind: 'emit',
            change: {
              op: 'equal',
              leftStart: leftEnd - suffix,
              rightStart: rightEnd - suffix,
              count: suffix,
            },
          }
        : undefined
    leftEnd -= suffix
    rightEnd -= suffix

    const leftSize = leftEnd - leftStart
    const rightSize = rightEnd - rightStart
    const core: Segment = { leftStart, leftEnd, rightStart, rightEnd }

    if (leftSize === 0 || rightSize === 0) {
      if (leftSize > 0) {
        pending.push({
          kind: 'emit',
          change: { op: 'delete', leftStart, rightStart, count: leftSize },
        })
      }
      if (rightSize > 0) {
        pending.push({
          kind: 'emit',
          change: { op: 'insert', leftStart: leftEnd, rightStart, count: rightSize },
        })
      }
    } else {
      const anchors =
        leftSize <= MIN_SEGMENT || rightSize <= MIN_SEGMENT ? [] : findAnchors(left, right, core)

      if (anchors.length === 0) {
        const segmentChanges = myersSegment(left, right, core, Math.max(1, deadline - Date.now()))
        if (segmentChanges === undefined) return undefined
        for (const change of segmentChanges) pending.push({ kind: 'emit', change })
      } else {
        let leftCursor = leftStart
        let rightCursor = rightStart
        for (const [leftAnchor, rightAnchor] of anchors) {
          if (leftAnchor > leftCursor || rightAnchor > rightCursor) {
            pending.push({
              kind: 'split',
              segment: {
                leftStart: leftCursor,
                leftEnd: leftAnchor,
                rightStart: rightCursor,
                rightEnd: rightAnchor,
              },
            })
          }
          pending.push({
            kind: 'emit',
            change: { op: 'equal', leftStart: leftAnchor, rightStart: rightAnchor, count: 1 },
          })
          leftCursor = leftAnchor + 1
          rightCursor = rightAnchor + 1
        }
        if (leftCursor < leftEnd || rightCursor < rightEnd) {
          pending.push({
            kind: 'split',
            segment: {
              leftStart: leftCursor,
              leftEnd: leftEnd,
              rightStart: rightCursor,
              rightEnd: rightEnd,
            },
          })
        }
      }
    }

    if (suffixTask) pending.push(suffixTask)
    // Reversed, because the stack pops last-in first.
    for (let i = pending.length - 1; i >= 0; i--) stack.push(pending[i] as Task)
  }

  return mergeChanges(changes)
}
