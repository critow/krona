import type { AlignedRow } from './align'

/** How to write the patch out. */
export interface PatchOptions {
  /** Unchanged lines kept around each change. Default 3, as `diff -u` does. */
  readonly context?: number
  /** Name on the `---` line. Default `a`. */
  readonly from?: string
  /** Name on the `+++` line. Default `b`. */
  readonly to?: string
}

type Kind = 'context' | 'remove' | 'add'

interface Op {
  readonly kind: Kind
  readonly text: string
}

/** One line of the patch body, in the order the two versions are read. */
function opsOf(
  rows: readonly AlignedRow[],
  left: readonly string[],
  right: readonly string[],
): { ops: Op[]; leftAt: number[]; rightAt: number[] } {
  const ops: Op[] = []
  // How many lines of each side precede every op, so a hunk header can be
  // written without walking back through the rows.
  const leftAt: number[] = []
  const rightAt: number[] = []
  let lefts = 0
  let rights = 0

  const push = (kind: Kind, text: string) => {
    leftAt.push(lefts)
    rightAt.push(rights)
    ops.push({ kind, text })
    if (kind !== 'add') lefts++
    if (kind !== 'remove') rights++
  }

  // Krona pairs a removed line with the line that replaced it, because that is
  // how a reader compares two panels. A patch is read down one column instead,
  // where every tool writes a run's removals first and then its additions, so
  // the pairs are unzipped again here — held back until the run ends rather
  // than emitted row by row.
  let removals: string[] = []
  let additions: string[] = []
  const flush = () => {
    for (const text of removals) push('remove', text)
    for (const text of additions) push('add', text)
    removals = []
    additions = []
  }

  for (const row of rows) {
    // A spacer exists so two panels stay level. One column of text has nothing
    // to stay level with, and a patch is one column of text.
    if (row.left === null && row.right === null) continue
    const from = row.left === null ? undefined : left[row.left]
    const to = row.right === null ? undefined : right[row.right]
    if (row.kind === 'equal' && from !== undefined && to !== undefined) {
      flush()
      push('context', to)
      continue
    }
    if (from !== undefined) removals.push(from)
    if (to !== undefined) additions.push(to)
  }
  flush()
  return { ops, leftAt, rightAt }
}

/** `start,count` as a hunk header writes it, with the count left off when it is 1. */
function span(start: number, count: number): string {
  // A side contributing nothing points at the line before the hunk, which is
  // what `@@ -0,0` means at the top of a file.
  const at = count === 0 ? start : start + 1
  return count === 1 ? `${at}` : `${at},${count}`
}

/**
 * The diff as a unified patch — the text `diff -u` prints and `git apply` reads.
 *
 * Built from the aligned rows rather than from a fresh diff, so the patch is of
 * what the reader is looking at: the same alignment the panels show, written as
 * one column. Folding and collapsed runs do not affect it — those hide lines
 * from the eye, not from the file.
 *
 * Returns an empty string when the two versions are identical: there is no such
 * thing as an empty patch, and a header with no hunks would be a lie about
 * having something to apply.
 *
 * Takes the two sides as lines rather than as parsed documents, because a patch
 * is text: it has no use for folding ranges, tokens or diagnostics, and asking
 * for a whole model would make a caller parse documents to reach a field. The
 * lines are what `diffLines` already carries — `result.left` and `result.right`.
 *
 * Line terminators are not described. A list of lines does not record whether
 * the last one ended with a newline, so the patch never carries
 * `\\ No newline at end of file`.
 */
export function unifiedPatch(
  rows: readonly AlignedRow[],
  left: readonly string[],
  right: readonly string[],
  options?: PatchOptions,
): string {
  const context = Math.max(0, options?.context ?? 3)
  const { ops, leftAt, rightAt } = opsOf(rows, left, right)

  // Each change, grown by the context around it; overlapping neighbours become
  // one hunk rather than two that repeat the same lines.
  const hunks: { start: number; end: number }[] = []
  for (let i = 0; i < ops.length; i++) {
    if (ops[i]?.kind === 'context') continue
    const start = Math.max(0, i - context)
    const end = Math.min(ops.length, i + context + 1)
    const last = hunks[hunks.length - 1]
    if (last && start <= last.end) last.end = Math.max(last.end, end)
    else hunks.push({ start, end })
  }
  if (hunks.length === 0) return ''

  const out: string[] = [`--- ${options?.from ?? 'a'}`, `+++ ${options?.to ?? 'b'}`]
  for (const hunk of hunks) {
    const slice = ops.slice(hunk.start, hunk.end)
    const removed = slice.filter((op) => op.kind !== 'add').length
    const added = slice.filter((op) => op.kind !== 'remove').length
    const fromStart = leftAt[hunk.start] ?? 0
    const toStart = rightAt[hunk.start] ?? 0
    out.push(`@@ -${span(fromStart, removed)} +${span(toStart, added)} @@`)
    for (const op of slice) {
      out.push(`${op.kind === 'remove' ? '-' : op.kind === 'add' ? '+' : ' '}${op.text}`)
    }
  }
  return `${out.join('\n')}\n`
}
