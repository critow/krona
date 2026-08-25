import type { AlignedRow } from '@krona/core'
import type { DisplayItem } from './rows'

/** One row of a unified diff: an aligned row read from one of the two sides. */
export interface UnifiedEntry {
  /** Index into the aligned rows, or -1 for an expand bar. */
  readonly rowIndex: number
  /** Which version this row's line comes from. Absent on an expand bar. */
  readonly side?: 'left' | 'right'
  /** Index into the collapsed regions, when this entry is an expand bar. */
  readonly regionIndex?: number
}

/**
 * Turns the rows both panels share into the single column of a unified diff.
 *
 * A unified diff is the same alignment read differently, which is why this is a
 * flattening and not a second diff: a changed row becomes the old line followed
 * by the new one, a row present on one side becomes that one line, and the
 * spacers that keep two panels level become nothing at all — there is no second
 * column left to stay level with.
 *
 * Unchanged rows are read from the right, so their numbers are the numbers of
 * the file as it is now, which is the file the reader still has.
 */
export function unifiedEntries(
  items: readonly DisplayItem[],
  rows: readonly AlignedRow[],
): UnifiedEntry[] {
  const entries: UnifiedEntry[] = []
  for (const item of items) {
    if (item.regionIndex !== undefined) {
      entries.push({ rowIndex: -1, regionIndex: item.regionIndex })
      continue
    }
    const row = rows[item.rowIndex]
    if (!row) continue
    if (row.kind === 'changed' && row.left !== null && row.right !== null) {
      entries.push({ rowIndex: item.rowIndex, side: 'left' })
      entries.push({ rowIndex: item.rowIndex, side: 'right' })
      continue
    }
    if (row.right !== null) entries.push({ rowIndex: item.rowIndex, side: 'right' })
    else if (row.left !== null) entries.push({ rowIndex: item.rowIndex, side: 'left' })
  }
  return entries
}
