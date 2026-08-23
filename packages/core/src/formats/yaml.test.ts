import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import '../index'
import './yaml'

const doc = (source: string) => parseDocument(source, 'yaml')

describe('yaml provider', () => {
  it('folds by indentation', () => {
    const model = doc(
      ['services:', '  api:', '    image: nginx', '    ports:', '      - "80:80"', 'x: 1'].join(
        '\n',
      ),
    )
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 4, level: 0, kind: 'block' },
      { startLine: 1, endLine: 4, level: 1, kind: 'block' },
      { startLine: 3, endLine: 4, level: 2, kind: 'block' },
    ])
  })

  it('treats a block scalar as a single folding range', () => {
    const source = ['command: |', '  set -e', '  run', 'next: 1'].join('\n')
    const model = doc(source)
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 2, level: 0, kind: 'scalar' }])
    expect(model.tokensAt(1)).toEqual([{ type: 'string', start: 0, end: 8 }])
  })

  it('handles folded scalars with chomping modifiers', () => {
    const model = doc(['notes: >-', '  one', '  two', 'other: 2'].join('\n'))
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 2, level: 0, kind: 'scalar' }])
  })

  it('folds a flow collection that spans lines', () => {
    const model = doc(['list: [', '  1,', '  2,', ']', 'after: 1'].join('\n'))
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 3, level: 0, kind: 'array' }])
  })

  it('keeps a left-margin comment from cutting a nested block short', () => {
    const model = doc(['a:', '  b: 1', '# note', '  c: 2', 'd: 3'].join('\n'))
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 3, level: 0, kind: 'block' }])
  })

  it('tokenizes keys, comments, anchors and aliases', () => {
    const model = doc('common: &anchor # shared\n  ref: *anchor')
    const first = model.tokensAt(0)
    expect(first[0]).toEqual({ type: 'key', start: 0, end: 6 })
    expect(first.some((t) => t.type === 'comment')).toBe(true)
    expect(model.tokensAt(1).some((t) => t.type === 'punctuation')).toBe(true)
  })

  it('classifies scalars', () => {
    const model = doc(['n: 42', 'f: 1.5', 'b: true', 'z: null', 's: hello', 'q: "hi"'].join('\n'))
    const typeOf = (line: number) => model.tokensAt(line).at(-1)?.type
    expect(typeOf(0)).toBe('number')
    expect(typeOf(1)).toBe('number')
    expect(typeOf(2)).toBe('boolean')
    expect(typeOf(3)).toBe('null')
    expect(typeOf(4)).toBe('string')
    expect(typeOf(5)).toBe('string')
  })

  it('marks sequence dashes as punctuation and folds their items', () => {
    const model = doc(['items:', '  - name: a', '    id: 1', '  - name: b'].join('\n'))
    expect(model.foldingRanges.map((r) => [r.startLine, r.endLine])).toEqual([
      [0, 3],
      [1, 2],
    ])
    expect(model.tokensAt(1)[0]).toEqual({ type: 'punctuation', start: 2, end: 3 })
  })

  it('reports structural errors as diagnostics instead of throwing', () => {
    const model = doc('a: 1\n b: [unclosed\n')
    expect(model.format).toBe('yaml')
    expect(model.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })

  it('never expands aliases, so a billion-laughs file stays cheap', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
    const lines = ['a: &a [x, x, x, x, x, x, x, x, x]']
    for (let i = 1; i < names.length; i++) {
      const self = names[i]
      const prev = names[i - 1]
      const refs = new Array(9).fill(`*${prev}`).join(', ')
      lines.push(`${self}: &${self} [${refs}]`)
    }
    const started = performance.now()
    const model = doc(lines.join('\n'))
    expect(model.format).toBe('yaml')
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('  :::: [[[[ }}}}')
    expect(model.lines).toHaveLength(1)
    expect(() => model.tokensAt(0)).not.toThrow()
  })
})
