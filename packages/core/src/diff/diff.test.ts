import { describe, expect, it } from 'vitest'
import { alignDiff, nextChangedRow, previousChangedRow, similarityOf } from './align'
import { diffLineArrays, diffLines } from './myers'

const kinds = (left: string, right: string) =>
  alignDiff(diffLines(left, right)).rows.map((r) => r.kind)

const pairs = (left: string, right: string) =>
  alignDiff(diffLines(left, right)).rows.map((r) => [r.left, r.right])

describe('diffLines', () => {
  it('reports identical documents as one equal run', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc')
    expect(result.changes).toEqual([{ op: 'equal', leftStart: 0, rightStart: 0, count: 3 }])
    expect(result.approximate).toBe(false)
  })

  it('finds an insertion', () => {
    const result = diffLines('a\nc', 'a\nb\nc')
    expect(result.changes.map((c) => [c.op, c.count])).toEqual([
      ['equal', 1],
      ['insert', 1],
      ['equal', 1],
    ])
  })

  it('finds a deletion', () => {
    const result = diffLines('a\nb\nc', 'a\nc')
    expect(result.changes.map((c) => [c.op, c.count])).toEqual([
      ['equal', 1],
      ['delete', 1],
      ['equal', 1],
    ])
  })

  it('treats a reordering as a real difference, like git does', () => {
    const result = diffLines('a: 1\nb: 2\n', 'b: 2\na: 1\n')
    expect(result.changes.some((c) => c.op !== 'equal')).toBe(true)
  })

  it('can ignore trailing whitespace', () => {
    const noisy = diffLines('a  \nb', 'a\nb')
    expect(noisy.changes.some((c) => c.op !== 'equal')).toBe(true)
    const clean = diffLines('a  \nb', 'a\nb', { ignoreTrailingWhitespace: true })
    expect(clean.changes).toEqual([{ op: 'equal', leftStart: 0, rightStart: 0, count: 2 }])
    expect(clean.left[0]).toBe('a  ')
  })

  it('falls back to a prefix/suffix approximation when it runs out of time', () => {
    const left = Array.from({ length: 400 }, (_, i) => `left ${i} ${i % 7}`)
    const right = Array.from({ length: 400 }, (_, i) => `right ${i * 3} ${i % 5}`)
    const result = diffLineArrays(['same', ...left, 'tail'], ['same', ...right, 'tail'], {
      timeout: 1,
    })
    expect(result.approximate).toBe(true)
    expect(result.changes[0]).toEqual({ op: 'equal', leftStart: 0, rightStart: 0, count: 1 })
    expect(result.changes.at(-1)?.op).toBe('equal')
    const covered = result.changes
      .filter((c) => c.op !== 'insert')
      .reduce((sum, c) => sum + c.count, 0)
    expect(covered).toBe(left.length + 2)
  })

  it('handles two completely different files', () => {
    const result = diffLines('a\nb\nc', 'x\ny\nz')
    expect(result.changes.some((c) => c.op === 'delete')).toBe(true)
    expect(result.changes.some((c) => c.op === 'insert')).toBe(true)
  })

  it('handles an empty side', () => {
    expect(diffLines('', 'a\nb').changes.map((c) => c.op)).toEqual(['delete', 'insert'])
    expect(diffLines('a\nb', '').changes.map((c) => c.op)).toEqual(['delete', 'insert'])
  })
})

describe('alignDiff', () => {
  it('pairs facing replacements into changed rows', () => {
    expect(kinds('port: 80\nx: 1', 'port: 443\nx: 1')).toEqual(['changed', 'equal'])
  })

  it('emits spacers so both panels stay aligned', () => {
    expect(pairs('a\nc', 'a\nb\nc')).toEqual([
      [0, 0],
      [null, 1],
      [1, 2],
    ])
  })

  it('pads an uneven replacement with the right spacers', () => {
    const rows = alignDiff(diffLines('a: 1\nb: 2\nz', 'a: 9\nz')).rows
    expect(rows).toEqual([
      { kind: 'changed', left: 0, right: 0 },
      { kind: 'removed', left: 1, right: null },
      { kind: 'equal', left: 2, right: 1 },
    ])
  })

  it('does not pair lines that have nothing in common', () => {
    expect(kinds('alpha', 'zzzzzzzzzz')).toEqual(['removed', 'added'])
  })

  it('can be told not to pair at all', () => {
    const aligned = alignDiff(diffLines('port: 80', 'port: 443'), { pairChanges: false })
    expect(aligned.rows.map((r) => r.kind)).toEqual(['removed', 'added'])
  })

  it('counts lines by category', () => {
    const aligned = alignDiff(diffLines('a\nb: 1\nc\nd', 'a\nb: 2\nc\nd\ne'))
    expect(aligned.stats).toEqual({ added: 1, removed: 0, changed: 1, unchanged: 3 })
  })

  it('shows a fully rewritten file as removals facing additions', () => {
    const aligned = alignDiff(diffLines('a\nb\nc', 'x\ny\nz'))
    expect(aligned.stats).toEqual({ added: 3, removed: 3, changed: 0, unchanged: 0 })
    // Nothing was similar enough to pair, so every row has exactly one side.
    expect(aligned.rows.every((r) => r.left === null || r.right === null)).toBe(true)
  })

  it('shows an added nested block as a run of added rows', () => {
    const before = ['{', '  "a": 1', '}'].join('\n')
    const after = ['{', '  "a": 1,', '  "nested": {', '    "b": 2', '  }', '}'].join('\n')
    const aligned = alignDiff(diffLines(before, after))
    expect(aligned.rows.map((r) => r.kind)).toEqual([
      'equal',
      'changed',
      'added',
      'added',
      'added',
      'equal',
    ])
    expect(aligned.stats.added).toBe(3)
  })

  it('shows a removed nested block as a run of removed rows', () => {
    const before = ['{', '  "a": 1,', '  "nested": {', '    "b": 2', '  }', '}'].join('\n')
    const after = ['{', '  "a": 1', '}'].join('\n')
    const aligned = alignDiff(diffLines(before, after))
    expect(aligned.stats.removed).toBe(3)
    expect(aligned.rows.filter((r) => r.kind === 'removed').every((r) => r.right === null)).toBe(
      true,
    )
  })

  it('navigates between changed rows', () => {
    const rows = alignDiff(diffLines('a\nb: 1\nc\nd: 1', 'a\nb: 2\nc\nd: 2')).rows
    expect(nextChangedRow(rows, 0)).toBe(1)
    expect(nextChangedRow(rows, 2)).toBe(3)
    expect(nextChangedRow(rows, 4)).toBe(-1)
    expect(previousChangedRow(rows, 3)).toBe(1)
    expect(previousChangedRow(rows, 0)).toBe(-1)
  })
})

describe('similarityOf', () => {
  it('is 1 for identical strings and 0 for unrelated ones', () => {
    expect(similarityOf('abc', 'abc')).toBe(1)
    expect(similarityOf('abc', 'xyz')).toBe(0)
    expect(similarityOf('', '')).toBe(1)
  })

  it('rewards a shared prefix and suffix', () => {
    expect(similarityOf('port: 80', 'port: 443')).toBeGreaterThan(0.5)
  })
})
