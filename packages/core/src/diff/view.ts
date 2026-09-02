import type { DocumentModel } from '../model/types'
import type { AlignedRow } from './align'
import type { CollapsedRegion } from './collapse'

/** One entry of the row list a diff shows, shared by both panels. */
export interface DisplayItem {
  /** Index into the aligned rows, or -1 for an expand bar. */
  readonly rowIndex: number
  /** Index into the collapsed regions, when this item is an expand bar. */
  readonly regionIndex?: number
}

/** Row lookups derived from the alignment, used to keep folding in step. */
export interface RowIndex {
  /** Row showing a given left-hand line, or -1. */
  readonly leftRowOf: Int32Array
  /** Row showing a given right-hand line, or -1. */
  readonly rightRowOf: Int32Array
}

/**
 * Line-to-row lookups, so a folding range found on one side can be translated
 * into the row span that must disappear from *both* panels.
 *
 * This is what makes folding synchronous without either side knowing about the
 * other.
 */
export function buildRowIndex(
  rows: readonly AlignedRow[],
  left: DocumentModel,
  right: DocumentModel,
): RowIndex {
  const leftRowOf = new Int32Array(left.lines.length).fill(-1)
  const rightRowOf = new Int32Array(right.lines.length).fill(-1)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    if (row.left !== null && row.left < leftRowOf.length) leftRowOf[row.left] = i
    if (row.right !== null && row.right < rightRowOf.length) rightRowOf[row.right] = i
  }
  return { leftRowOf, rightRowOf }
}

/**
 * Last row covered when the folding range starting at `rowIndex` is collapsed:
 * the further of the two sides' ranges, so neither panel is left showing lines
 * the other has hidden.
 */
export function foldEndRow(
  rowIndex: number,
  rows: readonly AlignedRow[],
  left: DocumentModel,
  right: DocumentModel,
  index: RowIndex,
): number {
  const row = rows[rowIndex]
  if (!row) return rowIndex
  let end = rowIndex
  if (row.left !== null) {
    const range = left.foldAt(row.left)
    if (range) {
      const candidate = index.leftRowOf[range.endLine] ?? -1
      if (candidate > end) end = candidate
    }
  }
  if (row.right !== null) {
    const range = right.foldAt(row.right)
    if (range) {
      const candidate = index.rightRowOf[range.endLine] ?? -1
      if (candidate > end) end = candidate
    }
  }
  return end
}

/** True when either side has a folding range starting on this row. */
export function hasFoldAt(
  rowIndex: number,
  rows: readonly AlignedRow[],
  left: DocumentModel,
  right: DocumentModel,
): boolean {
  const row = rows[rowIndex]
  if (!row) return false
  if (row.left !== null && left.foldAt(row.left)) return true
  return row.right !== null && right.foldAt(row.right) !== undefined
}

/**
 * The rows a diff actually shows, once folding and collapsing are applied.
 *
 * Walks the aligned rows once, skipping folded ranges and replacing each
 * hidden unchanged run with a single expand bar. Both panels read this same
 * list, so they cannot drift out of alignment — which is the whole reason it
 * is computed for the diff rather than for a panel.
 */
export function displayItems(
  rows: readonly AlignedRow[],
  left: DocumentModel,
  right: DocumentModel,
  index: RowIndex,
  collapsedRows: ReadonlySet<number>,
  regions: readonly (CollapsedRegion | null)[],
): DisplayItem[] {
  const regionAt = new Map<number, number>()
  regions.forEach((region, regionIndex) => {
    if (region) regionAt.set(region.startRow, regionIndex)
  })

  const items: DisplayItem[] = []
  let i = 0
  while (i < rows.length) {
    const regionIndex = regionAt.get(i)
    if (regionIndex !== undefined) {
      const region = regions[regionIndex]
      if (region) {
        items.push({ rowIndex: -1, regionIndex })
        i = region.endRow + 1
        continue
      }
    }
    items.push({ rowIndex: i })
    if (collapsedRows.has(i)) {
      i = foldEndRow(i, rows, left, right, index) + 1
      continue
    }
    i++
  }
  return items
}

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
