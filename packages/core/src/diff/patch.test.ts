import { describe, expect, it } from 'vitest'
import { alignDiff } from './align'
import { diffLines } from './myers'
import { unifiedPatch } from './patch'

/** The patch two texts produce, through the same path the viewer takes. */
function patchOf(before: string, after: string, options?: Parameters<typeof unifiedPatch>[3]) {
  const result = diffLines(before, after)
  const { rows } = alignDiff(result)
  return unifiedPatch(rows, result.left, result.right, options)
}

const LONG = (marker: string) =>
  [
    '{',
    '  "a": 1,',
    '  "b": 2,',
    `  "c": ${marker},`,
    '  "d": 4,',
    '  "e": 5,',
    '  "f": 6',
    '}',
  ].join('\n')

describe('unifiedPatch', () => {
  it('says nothing when there is nothing to say', () => {
    expect(patchOf('{"a": 1}', '{"a": 1}')).toBe('')
  })

  it('writes the headers, a hunk and the change', () => {
    expect(patchOf(LONG('3'), LONG('9'))).toBe(
      [
        '--- a',
        '+++ b',
        '@@ -1,7 +1,7 @@',
        // Context lines carry a leading space, which is what tells a patch
        // tool they are context rather than the start of the file.
        ' {',
        '   "a": 1,',
        '   "b": 2,',
        '-  "c": 3,',
        '+  "c": 9,',
        '   "d": 4,',
        '   "e": 5,',
        '   "f": 6',
        '',
      ].join('\n'),
    )
  })

  it('puts the removals before the additions', () => {
    const before = ['a', 'b', 'c'].join('\n')
    const after = ['x', 'y', 'c'].join('\n')
    const body = patchOf(before, after)
      .split('\n')
      .filter((line) => line.startsWith('-') || line.startsWith('+'))
      .filter((line) => !line.startsWith('---') && !line.startsWith('+++'))
    expect(body).toEqual(['-a', '-b', '+x', '+y'])
  })

  it('unzips the pairs Krona shows side by side', () => {
    // These lines are alike enough that the alignment pairs each removal with
    // the addition that replaced it — which is right for two panels and wrong
    // for one column, where every tool writes the removals first.
    const before = ['{', '  "host": "0.0.0.0",', '  "port": 8080', '}'].join('\n')
    const after = ['{', '  "host": "127.0.0.1",', '  "port": 9090', '}'].join('\n')
    const body = patchOf(before, after)
      .split('\n')
      .filter((line) => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
    expect(body).toEqual([
      '-  "host": "0.0.0.0",',
      '-  "port": 8080',
      '+  "host": "127.0.0.1",',
      '+  "port": 9090',
    ])
  })

  it('keeps the asked-for amount of context and no more', () => {
    const patch = patchOf(LONG('3'), LONG('9'), { context: 1 })
    expect(patch).toContain('@@ -3,3 +3,3 @@')
    expect(patch).not.toContain('"a": 1')
  })

  it('joins two changes that share their context into one hunk', () => {
    const before = ['1', '2', '3', '4', '5'].join('\n')
    const after = ['x', '2', '3', '4', 'y'].join('\n')
    // Three lines of context reach from the first change to the last.
    expect(patchOf(before, after).match(/^@@/gm)).toHaveLength(1)
  })

  it('keeps two distant changes apart', () => {
    const before = Array.from({ length: 30 }, (_, i) => String(i)).join('\n')
    const after = before.replace(/^0$/m, 'x').replace(/^29$/m, 'y')
    expect(patchOf(before, after).match(/^@@/gm)).toHaveLength(2)
  })

  it('points at the line before a side that contributes nothing', () => {
    // Every line is new, so the old file offers no line to start from.
    const patch = patchOf('', ['a', 'b'].join('\n'))
    expect(patch).toContain('@@ -1 +1,2 @@')
  })

  it('leaves the count off a hunk covering a single line', () => {
    expect(patchOf('a', 'b')).toContain('@@ -1 +1 @@')
  })

  it('takes the names it is given', () => {
    const patch = patchOf('a', 'b', { from: 'a/config.json', to: 'b/config.json' })
    expect(patch.startsWith('--- a/config.json\n+++ b/config.json\n')).toBe(true)
  })
})
