import { describe, expect, it } from 'vitest'
import { type DiffChange, diffLineArrays, diffLines } from './myers'

/** Rebuilds both sides from a change list; any valid diff must round-trip. */
function reconstruct(
  changes: readonly DiffChange[],
  left: readonly string[],
  right: readonly string[],
): { left: string[]; right: string[] } {
  const outLeft: string[] = []
  const outRight: string[] = []
  for (const change of changes) {
    for (let i = 0; i < change.count; i++) {
      if (change.op !== 'insert') outLeft.push(left[change.leftStart + i] as string)
      if (change.op !== 'delete') outRight.push(right[change.rightStart + i] as string)
    }
  }
  return { left: outLeft, right: outRight }
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x1_0000_0000
  }
}

function randomLines(random: () => number, count: number): string[] {
  const alphabet = ['a: 1', 'b: 2', 'c: 3', '{', '}', '', '  x', '  y', 'z: "long value here"']
  return Array.from(
    { length: count },
    () => alphabet[Math.floor(random() * alphabet.length)] as string,
  )
}

const STRATEGIES = ['anchored', 'myers'] as const

describe.each(STRATEGIES)('%s strategy', (strategy) => {
  const diff = (left: string, right: string) => diffLines(left, right, { strategy })

  it('reports identical documents as equal', () => {
    const result = diff('a\nb\nc', 'a\nb\nc')
    expect(result.changes).toEqual([{ op: 'equal', leftStart: 0, rightStart: 0, count: 3 }])
  })

  it('round-trips both documents', () => {
    const left = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}'
    const right = '{\n  "a": 1,\n  "b": 9,\n  "d": 4,\n  "c": 3\n}'
    const result = diff(left, right)
    const rebuilt = reconstruct(result.changes, result.left, result.right)
    expect(rebuilt.left).toEqual(result.left)
    expect(rebuilt.right).toEqual(result.right)
  })

  it('round-trips random documents', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = makeRandom(seed * 2654435761)
      const left = randomLines(random, 40)
      const right = randomLines(random, 45)
      const result = diffLineArrays(left, right, { strategy })
      const rebuilt = reconstruct(result.changes, left, right)
      expect(rebuilt.left, `seed ${seed}`).toEqual(left)
      expect(rebuilt.right, `seed ${seed}`).toEqual(right)
    }
  })

  it('never emits two adjacent runs with the same operation', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = makeRandom(seed * 40503)
      const result = diffLineArrays(randomLines(random, 30), randomLines(random, 30), { strategy })
      for (let i = 1; i < result.changes.length; i++) {
        expect(result.changes[i]?.op, `seed ${seed}`).not.toBe(result.changes[i - 1]?.op)
      }
    }
  })

  it('handles an empty side', () => {
    expect(diff('', 'a\nb').changes.map((c) => c.op)).toEqual(['delete', 'insert'])
    expect(diff('a\nb', '').changes.map((c) => c.op)).toEqual(['delete', 'insert'])
  })
})

describe('anchored strategy', () => {
  it('agrees with plain Myers on how many lines are unchanged', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = makeRandom(seed * 2246822519)
      const left = randomLines(random, 50)
      const right = randomLines(random, 50)
      const anchored = diffLineArrays(left, right, { strategy: 'anchored' })
      const myers = diffLineArrays(left, right, { strategy: 'myers' })
      const equalCount = (changes: readonly DiffChange[]) =>
        changes.filter((c) => c.op === 'equal').reduce((sum, c) => sum + c.count, 0)
      // Anchoring picks different — never more — common lines than the optimal
      // algorithm; a big shortfall would mean the anchors are being wasted.
      expect(equalCount(anchored.changes), `seed ${seed}`).toBeLessThanOrEqual(
        equalCount(myers.changes),
      )
      expect(equalCount(anchored.changes), `seed ${seed}`).toBeGreaterThan(
        equalCount(myers.changes) * 0.7,
      )
    }
  })

  it('anchors on unique lines so a moved block reads as moved', () => {
    const left = ['head', 'unique-alpha', 'x', 'y', 'unique-omega', 'tail'].join('\n')
    const right = ['head', 'unique-alpha', 'x', 'y', 'z', 'unique-omega', 'tail'].join('\n')
    const result = diffLines(left, right, { strategy: 'anchored' })
    expect(result.changes.map((c) => [c.op, c.count])).toEqual([
      ['equal', 4],
      ['insert', 1],
      ['equal', 2],
    ])
  })

  it('stays iterative on deeply segmented input', () => {
    const left = Array.from({ length: 20_000 }, (_, i) => `line ${i}`)
    const right = left.map((line, i) => (i % 2 === 0 ? line : `${line} changed`))
    const result = diffLineArrays(left, right, { strategy: 'anchored', timeout: 10_000 })
    expect(result.approximate).toBe(false)
    const rebuilt = reconstruct(result.changes, left, right)
    expect(rebuilt.right).toEqual(right)
  })

  it('falls back to an approximation when the budget is exhausted', () => {
    const left = Array.from({ length: 6000 }, (_, i) => `${i % 3}`)
    const right = Array.from({ length: 6000 }, (_, i) => `${i % 5}`)
    const result = diffLineArrays(left, right, { timeout: 1 })
    expect(result.approximate).toBe(true)
    const rebuilt = reconstruct(result.changes, left, right)
    expect(rebuilt.left).toEqual(left)
    expect(rebuilt.right).toEqual(right)
  })
})
