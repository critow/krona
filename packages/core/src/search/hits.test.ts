import { describe, expect, it } from 'vitest'
import type { AlignedRow } from '../diff/align'
import { hitFrom, hitsInRowOrder, indexByLine, type SearchHit } from './hits'

const match = (lineIndex: number, start: number, end = start + 3) => ({ lineIndex, start, end })

describe('indexByLine', () => {
  it('groups the matches of a line together, keeping their order', () => {
    const index = indexByLine([match(2, 0), match(5, 4), match(2, 10)])
    expect([...index.keys()]).toEqual([2, 5])
    expect(index.get(2)?.map((span) => span.start)).toEqual([0, 10])
  })

  it('answers nothing for a line with no matches', () => {
    expect(indexByLine([match(1, 0)]).get(9)).toBeUndefined()
  })
})

describe('hitsInRowOrder', () => {
  const row = (left: number | null, right: number | null): AlignedRow =>
    ({ left, right, kind: left === null || right === null ? 'added' : 'equal' }) as AlignedRow

  it('reads down the screen rather than through one file and then the other', () => {
    const rows = [row(0, 0), row(1, 1), row(2, 2)]
    const hits = hitsInRowOrder(
      rows,
      indexByLine([match(0, 0), match(2, 0)]),
      indexByLine([match(1, 0)]),
    )
    // Row 0 left, row 1 right, row 2 left — interleaved, not grouped by side.
    expect(hits.map((hit) => [hit.row, hit.side])).toEqual([
      [0, 'left'],
      [1, 'right'],
      [2, 'left'],
    ])
  })

  it('puts the left side of a shared row first', () => {
    const hits = hitsInRowOrder([row(4, 7)], indexByLine([match(4, 0)]), indexByLine([match(7, 0)]))
    expect(hits.map((hit) => [hit.side, hit.lineIndex])).toEqual([
      ['left', 4],
      ['right', 7],
    ])
  })

  it('skips the empty half of a one-sided row', () => {
    const hits = hitsInRowOrder(
      [row(null, 3)],
      indexByLine([match(3, 0)]),
      indexByLine([match(3, 0)]),
    )
    expect(hits).toHaveLength(1)
    expect(hits[0]?.side).toBe('right')
  })
})

describe('hitFrom', () => {
  const hits: SearchHit[] = [
    { lineIndex: 1, start: 4, end: 7, side: 'single' },
    { lineIndex: 3, start: 0, end: 3, side: 'single' },
    { lineIndex: 3, start: 9, end: 12, side: 'single' },
  ]

  it('starts from where the reader is, not from the top of the file', () => {
    expect(hitFrom(hits, { lineIndex: 2, column: 0 }, 1)).toBe(1)
    expect(hitFrom(hits, { lineIndex: 3, column: 1 }, 1)).toBe(2)
  })

  it('walks backwards from there too', () => {
    expect(hitFrom(hits, { lineIndex: 3, column: 5 }, -1)).toBe(1)
    expect(hitFrom(hits, { lineIndex: 2, column: 0 }, -1)).toBe(0)
  })

  it('comes round to the far end rather than stopping', () => {
    expect(hitFrom(hits, { lineIndex: 99, column: 0 }, 1)).toBe(0)
    expect(hitFrom(hits, { lineIndex: -1, column: -1 }, -1)).toBe(2)
  })

  it('says so when there is nothing to walk', () => {
    expect(hitFrom([], { lineIndex: 0, column: 0 }, 1)).toBe(-1)
  })
})
