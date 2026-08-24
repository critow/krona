import { describe, expect, it } from 'vitest'
import type { AlignedRow } from './align'
import { collapseUnchanged, expandRegion, hiddenCount, hiddenRowSet } from './collapse'

function rows(pattern: string): AlignedRow[] {
  return [...pattern].map((c, i) => ({
    kind: c === '=' ? 'equal' : 'changed',
    left: i,
    right: i,
  }))
}

describe('collapseUnchanged', () => {
  it('collapses a long unchanged run, keeping context on both sides', () => {
    const regions = collapseUnchanged(rows(`x${'='.repeat(30)}x`), { context: 3 })
    expect(regions).toEqual([{ startRow: 4, endRow: 27 }])
  })

  it('leaves short runs alone', () => {
    expect(collapseUnchanged(rows('x====x'), { context: 3, minimumHidden: 10 })).toEqual([])
  })

  it('needs no leading context at the top of the file', () => {
    const regions = collapseUnchanged(rows(`${'='.repeat(30)}x`), { context: 3 })
    expect(regions).toEqual([{ startRow: 0, endRow: 26 }])
  })

  it('needs no trailing context at the end of the file', () => {
    const regions = collapseUnchanged(rows(`x${'='.repeat(30)}`), { context: 3 })
    expect(regions).toEqual([{ startRow: 4, endRow: 30 }])
  })

  it('collapses an entirely unchanged document', () => {
    expect(collapseUnchanged(rows('='.repeat(40)), { context: 3 })).toEqual([
      { startRow: 0, endRow: 39 },
    ])
  })

  it('finds every run in a document with several changes', () => {
    const regions = collapseUnchanged(rows(`${'='.repeat(20)}x${'='.repeat(20)}x`), { context: 2 })
    expect(regions).toEqual([
      { startRow: 0, endRow: 17 },
      { startRow: 23, endRow: 38 },
    ])
  })

  it('handles an empty document', () => {
    expect(collapseUnchanged([])).toEqual([])
  })
})

describe('expandRegion', () => {
  const region = { startRow: 10, endRow: 100 }

  it('reveals rows from the top', () => {
    expect(expandRegion(region, 'up', 20)).toEqual({ startRow: 30, endRow: 100 })
  })

  it('reveals rows from the bottom', () => {
    expect(expandRegion(region, 'down', 20)).toEqual({ startRow: 10, endRow: 80 })
  })

  it('reveals everything', () => {
    expect(expandRegion(region, 'all')).toBeNull()
    expect(expandRegion(region, 'up', 1000)).toBeNull()
  })

  it('counts the rows it hides', () => {
    expect(hiddenCount(region)).toBe(91)
  })
})

describe('hiddenRowSet', () => {
  it('lists every hidden row', () => {
    expect([...hiddenRowSet([{ startRow: 2, endRow: 4 }])]).toEqual([2, 3, 4])
  })
})
