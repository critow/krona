import { describe, expect, it } from 'vitest'
import '../formats/json'
import { parseDocument } from '../model/document'
import type { AlignedRow } from './align'
import type { CollapsedRegion } from './collapse'
import { buildRowIndex, displayItems, foldEndRow, hasFoldAt, unifiedEntries } from './view'

const BEFORE = ['{', '  "server": {', '    "port": 8080', '  },', '  "tail": 1', '}'].join('\n')
const AFTER = BEFORE.replace('8080', '9090')

const models = () => ({
  left: parseDocument(BEFORE, 'json'),
  right: parseDocument(AFTER, 'json'),
})

/** The alignment these two documents produce: one changed row, five equal. */
function rowsOf(): AlignedRow[] {
  return [0, 1, 2, 3, 4, 5].map(
    (i) => ({ left: i, right: i, kind: i === 2 ? 'changed' : 'equal' }) as AlignedRow,
  )
}

describe('buildRowIndex', () => {
  it('maps each line of both versions to the row that shows it', () => {
    const { left, right } = models()
    const index = buildRowIndex(rowsOf(), left, right)
    expect([...index.leftRowOf]).toEqual([0, 1, 2, 3, 4, 5])
    expect([...index.rightRowOf]).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('leaves a line no row shows at -1', () => {
    const { left, right } = models()
    // Only the first two rows are aligned; the rest of the file has no row.
    const index = buildRowIndex([{ left: 0, right: 0, kind: 'equal' } as AlignedRow], left, right)
    expect(index.leftRowOf[0]).toBe(0)
    expect(index.leftRowOf[3]).toBe(-1)
  })
})

describe('foldEndRow and hasFoldAt', () => {
  it('finds the fold that either side opens on a row', () => {
    const { left, right } = models()
    const rows = rowsOf()
    expect(hasFoldAt(1, rows, left, right)).toBe(true)
    expect(hasFoldAt(2, rows, left, right)).toBe(false)
  })

  it('covers the further of the two sides, so neither panel keeps a hidden line', () => {
    const { left, right } = models()
    const rows = rowsOf()
    const index = buildRowIndex(rows, left, right)
    // The server object runs from line 1 to line 3 in both versions.
    expect(foldEndRow(1, rows, left, right, index)).toBe(3)
    // A row that opens nothing covers only itself.
    expect(foldEndRow(4, rows, left, right, index)).toBe(4)
  })
})

describe('displayItems', () => {
  const setup = () => {
    const { left, right } = models()
    const rows = rowsOf()
    return { left, right, rows, index: buildRowIndex(rows, left, right) }
  }

  it('is every row when nothing is folded or collapsed', () => {
    const { left, right, rows, index } = setup()
    const items = displayItems(rows, left, right, index, new Set(), [])
    expect(items.map((item) => item.rowIndex)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('keeps the row that opens a fold and skips to the end of it', () => {
    const { left, right, rows, index } = setup()
    const items = displayItems(rows, left, right, index, new Set([1]), [])
    expect(items.map((item) => item.rowIndex)).toEqual([0, 1, 4, 5])
  })

  it('replaces a collapsed run with one expand bar', () => {
    const { left, right, rows, index } = setup()
    const region: CollapsedRegion = { startRow: 3, endRow: 5 } as CollapsedRegion
    const items = displayItems(rows, left, right, index, new Set(), [region])
    expect(items.map((item) => [item.rowIndex, item.regionIndex])).toEqual([
      [0, undefined],
      [1, undefined],
      [2, undefined],
      [-1, 0],
    ])
  })
})

describe('unifiedEntries', () => {
  it('reads a changed row twice, old above new', () => {
    const rows = rowsOf()
    const entries = unifiedEntries(
      rows.map((_, rowIndex) => ({ rowIndex })),
      rows,
    )
    // Row 2 is the changed one, so it appears as left then right.
    expect(entries.filter((entry) => entry.rowIndex === 2).map((entry) => entry.side)).toEqual([
      'left',
      'right',
    ])
    // Every other row appears once, read from the version the reader still has.
    expect(entries.filter((entry) => entry.rowIndex === 0).map((entry) => entry.side)).toEqual([
      'right',
    ])
  })

  it('flattens a whole alignment in the order it is read', () => {
    const rows = [
      { left: 0, right: 0, kind: 'equal' },
      { left: 1, right: 1, kind: 'changed' },
      { left: 2, right: null, kind: 'removed' },
      { left: null, right: 2, kind: 'added' },
      // A spacer keeps two panels level; one column has nothing to stay level with.
      { left: null, right: null, kind: 'equal' },
    ] as AlignedRow[]
    expect(
      unifiedEntries(
        rows.map((_, rowIndex) => ({ rowIndex })),
        rows,
      ),
    ).toEqual([
      { rowIndex: 0, side: 'right' },
      { rowIndex: 1, side: 'left' },
      { rowIndex: 1, side: 'right' },
      { rowIndex: 2, side: 'left' },
      { rowIndex: 3, side: 'right' },
    ])
  })

  it('drops the spacers that only exist to keep two panels level', () => {
    const rows = [
      { left: 0, right: null, kind: 'removed' },
      { left: null, right: null, kind: 'equal' },
    ] as AlignedRow[]
    const entries = unifiedEntries([{ rowIndex: 0 }, { rowIndex: 1 }], rows)
    expect(entries).toEqual([{ rowIndex: 0, side: 'left' }])
  })

  it('carries an expand bar through untouched', () => {
    const entries = unifiedEntries([{ rowIndex: -1, regionIndex: 2 }], [])
    expect(entries).toEqual([{ rowIndex: -1, regionIndex: 2 }])
  })
})
