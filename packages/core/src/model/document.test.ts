import { describe, expect, it } from 'vitest'
import '../index'
import '../formats/yaml'
import { fromSnapshot, parseDocument, toSnapshot } from './document'
import { splitLines } from './lines'
import { detectFormat, getFormat, registerFormat, unregisterFormat } from './registry'

describe('splitLines', () => {
  it('accepts LF, CRLF and CR', () => {
    expect(splitLines('a\nb')).toEqual(['a', 'b'])
    expect(splitLines('a\r\nb')).toEqual(['a', 'b'])
    expect(splitLines('a\rb')).toEqual(['a', 'b'])
  })

  it('does not invent a line for a trailing newline', () => {
    expect(splitLines('a\n')).toEqual(['a'])
    expect(splitLines('a\n\n')).toEqual(['a', ''])
  })

  it('treats empty input as one empty line', () => {
    expect(splitLines('')).toEqual([''])
  })
})

describe('splitLines with a limit', () => {
  it('stops once it has the lines it was asked for', () => {
    expect(splitLines('a\nb\nc', 2)).toEqual(['a', 'b'])
    expect(splitLines('a\nb\nc', 3)).toEqual(['a', 'b', 'c'])
    expect(splitLines('a\nb\nc', 9)).toEqual(['a', 'b', 'c'])
    expect(splitLines('abc', 1)).toEqual(['abc'])
  })

  it('still reads a trailing newline the way it does without one', () => {
    expect(splitLines('a\n', 5)).toEqual(['a'])
    expect(splitLines('', 5)).toEqual([''])
    expect(splitLines('\n', 5)).toEqual([''])
  })
})

describe('parseDocument', () => {
  it('keeps only the first lines of a document with too many of them', () => {
    // Size alone does not bound the work: a file of newlines fits under
    // `maxInputLength` and still asks for a record per line.
    const model = parseDocument('a\nb\nc\nd', 'json', { limits: { maxLines: 2 } })
    expect(model.format).toBe('text')
    expect(model.lines.map((line) => line.text)).toEqual(['a', 'b'])
    expect(model.diagnostics[0]?.code).toBe('too-many-lines')
    expect(model.foldingRanges).toEqual([])
  })

  it('stops splitting an oversized document at the line limit', () => {
    const model = parseDocument('x\n'.repeat(1000), 'json', {
      limits: { maxInputLength: 100, maxLines: 10 },
    })
    expect(model.lines).toHaveLength(10)
    expect(model.diagnostics[0]?.code).toBe('input-too-large')
  })

  it('falls back to plain text for an unknown format, with a diagnostic', () => {
    const model = parseDocument('hello', 'klingon')
    expect(model.format).toBe('text')
    expect(model.foldingRanges).toEqual([])
    expect(model.diagnostics[0]?.code).toBe('unknown-format')
  })

  it('refuses oversized input instead of parsing it', () => {
    const source = 'x'.repeat(200)
    const model = parseDocument(source, 'json', { limits: { maxInputLength: 100 } })
    expect(model.format).toBe('text')
    expect(model.diagnostics[0]?.code).toBe('input-too-large')
    expect(model.lines).toHaveLength(1)
  })

  it('drops folding ranges past the depth limit', () => {
    const depth = 12
    const source = `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`.split(':').join(':\n')
    const model = parseDocument(source, 'json', { limits: { maxDepth: 3 } })
    expect(model.foldingRanges.every((r) => r.level < 3)).toBe(true)
    expect(model.diagnostics.some((d) => d.code === 'max-depth-exceeded')).toBe(true)
  })

  it('does not tokenize absurdly long lines', () => {
    const model = parseDocument(`{"a":"${'x'.repeat(50)}"}`, 'json', {
      limits: { maxTokenizedLineLength: 10 },
    })
    expect(model.tokensAt(0)).toEqual([])
  })

  it('survives a provider that throws', () => {
    registerFormat({
      id: 'boom',
      displayName: 'Boom',
      extensions: [],
      analyze: () => {
        throw new Error('nope')
      },
      tokenize: () => [],
    })
    const model = parseDocument('a\nb', 'boom')
    expect(model.format).toBe('text')
    expect(model.diagnostics[0]?.code).toBe('analyze-failed')
    unregisterFormat('boom')
  })

  it('memoizes tokens per line', () => {
    const model = parseDocument('{"a": 1}', 'json')
    expect(model.tokensAt(0)).toBe(model.tokensAt(0))
  })

  it('round-trips through a worker-style snapshot', () => {
    const model = parseDocument('{\n  "a": 1\n}', 'json')
    const snapshot = structuredClone(toSnapshot(model))
    const restored = fromSnapshot(snapshot)
    expect(restored.foldingRanges).toEqual(model.foldingRanges)
    expect(restored.tokensAt(1)).toEqual(model.tokensAt(1))
  })
})

describe('detectFormat', () => {
  const detect = (source: string) => detectFormat(source, source.split('\n'))

  it('recognises JSON', () => {
    expect(detect('{\n  "a": 1\n}')).toBe('json')
  })

  it('recognises YAML once the provider is registered', () => {
    expect(getFormat('yaml')).toBeDefined()
    expect(detect('---\na: 1\nb:\n  - c\n')).toBe('yaml')
  })

  it('recognises TOML', () => {
    expect(detect('[package]\nname = "x"\n')).toBe('toml')
  })

  it('falls back to text for prose', () => {
    expect(detect('just some words\nand more words\n')).toBe('text')
  })

  it('is used by format="auto"', () => {
    expect(parseDocument('{\n "a": 1\n}', 'auto').format).toBe('json')
  })
})
