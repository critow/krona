import type { AlignedRow } from './align'

/**
 * A run of unchanged rows that the viewer hides behind a
 * "N hidden lines" bar, with the same up / down / all expansion GitHub offers.
 */
export interface CollapsedRegion {
  /** First hidden row index (inclusive). */
  readonly startRow: number
  /** Last hidden row index (inclusive). */
  readonly endRow: number
}

/** Options for {@link collapseUnchanged}. */
export interface CollapseOptions {
  /** Unchanged rows kept visible on each side of a change. Default 3. */
  readonly context?: number
  /**
   * Only runs longer than this collapse; below it the bar would cost more
   * vertical space than the lines it hides. Default 10.
   */
  readonly minimumHidden?: number
}

const DEFAULT_CONTEXT = 3
const DEFAULT_MINIMUM_HIDDEN = 10

/** Number of rows a region hides. */
export function hiddenCount(region: CollapsedRegion): number {
  return region.endRow - region.startRow + 1
}

/**
 * Finds the runs of unchanged rows worth collapsing.
 *
 * @example
 * ```ts
 * const regions = collapseUnchanged(rows, { context: 3 })
 * regions[0] // { startRow: 4, endRow: 96 }
 * ```
 */
export function collapseUnchanged(
  rows: readonly AlignedRow[],
  options?: CollapseOptions,
): CollapsedRegion[] {
  const context = Math.max(0, options?.context ?? DEFAULT_CONTEXT)
  const minimumHidden = Math.max(1, options?.minimumHidden ?? DEFAULT_MINIMUM_HIDDEN)

  const regions: CollapsedRegion[] = []
  let runStart = -1

  const flush = (runEnd: number): void => {
    if (runStart < 0) return
    // The first and last runs touch the file edges, so they only need context on
    // the side that faces a change.
    const leadingContext = runStart === 0 ? 0 : context
    const trailingContext = runEnd === rows.length - 1 ? 0 : context
    const start = runStart + leadingContext
    const end = runEnd - trailingContext
    if (end - start + 1 >= minimumHidden) regions.push({ startRow: start, endRow: end })
    runStart = -1
  }

  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] as AlignedRow).kind === 'equal') {
      if (runStart < 0) runStart = i
    } else {
      flush(i - 1)
    }
  }
  flush(rows.length - 1)
  return regions
}

/** Which end of a collapsed region an expansion reveals. */
export type ExpandDirection = 'up' | 'down' | 'all'

/**
 * Reveals part of a collapsed region, returning what stays hidden — or `null`
 * once nothing does. Pure, so the viewer can keep expansion in ordinary state.
 *
 * @example
 * ```ts
 * let region = { startRow: 10, endRow: 100 }
 * region = expandRegion(region, 'down', 20) // { startRow: 10, endRow: 80 }
 * ```
 */
export function expandRegion(
  region: CollapsedRegion,
  direction: ExpandDirection,
  step = 20,
): CollapsedRegion | null {
  if (direction === 'all') return null
  const size = hiddenCount(region)
  if (step >= size) return null
  return direction === 'up'
    ? { startRow: region.startRow + step, endRow: region.endRow }
    : { startRow: region.startRow, endRow: region.endRow - step }
}

/**
 * Builds a lookup from row index to the region hiding it, so the renderer can
 * skip hidden rows in O(1) per row.
 */
export function hiddenRowSet(regions: readonly CollapsedRegion[]): Set<number> {
  const hidden = new Set<number>()
  for (const region of regions) {
    for (let i = region.startRow; i <= region.endRow; i++) hidden.add(i)
  }
  return hidden
}
