import { describe, expect, it } from 'vitest'
import '../formats/json'
import '../formats/yaml'
import { parseDocument } from '../model/document'
import { registerFormat, unregisterFormat } from '../model/registry'
import {
  applyEdit,
  blockSpanAt,
  duplicateBlockEdit,
  formattedEdit,
  lineSpanAt,
  minimalEdit,
  removeBlockEdit,
  valueSpansAt,
} from './edit'

const JSON_DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0",',
  '    "timeouts": { "read": 30, "write": 60 }',
  '  },',
  '  "last": true',
  '}',
].join('\n')

function parse(source: string, format = 'json') {
  return parseDocument(source, format)
}

function textOf(source: string, span: { start: number; end: number }): string {
  return source.slice(span.start, span.end)
}

/** The least a provider can be, so a test can give it one bad formatter. */
const PLAIN = {
  displayName: 'Plain',
  extensions: [],
  analyze: () => ({ foldingRanges: [] }),
  tokenize: () => [],
}

describe('applyEdit', () => {
  it('replaces the span and hands back the edit that undoes it', () => {
    const { source, inverse } = applyEdit('abcdef', { start: 2, end: 4, text: 'XYZ' })
    expect(source).toBe('abXYZef')
    expect(applyEdit(source, inverse).source).toBe('abcdef')
  })

  it('round-trips an insertion and a deletion', () => {
    const inserted = applyEdit('ab', { start: 1, end: 1, text: '--' })
    expect(inserted.source).toBe('a--b')
    expect(applyEdit(inserted.source, inserted.inverse).source).toBe('ab')

    const deleted = applyEdit('abcd', { start: 1, end: 3, text: '' })
    expect(deleted.source).toBe('ad')
    expect(applyEdit(deleted.source, deleted.inverse).source).toBe('abcd')
  })

  it('refuses a span outside the document', () => {
    expect(() => applyEdit('ab', { start: 0, end: 9, text: '' })).toThrow(RangeError)
    expect(() => applyEdit('ab', { start: 2, end: 1, text: '' })).toThrow(RangeError)
  })
})

describe('applyEdit offsets', () => {
  it('refuses an offset that is not a whole number', () => {
    // `NaN` compares false with every bound, so without the check it slips
    // through and the inverse edit records coordinates that undo nothing.
    expect(() => applyEdit('ab', { start: Number.NaN, end: 1, text: 'x' })).toThrow(RangeError)
    expect(() => applyEdit('ab', { start: 0, end: Number.NaN, text: 'x' })).toThrow(RangeError)
    expect(() => applyEdit('ab', { start: 0.5, end: 1, text: 'x' })).toThrow(RangeError)
  })
})

describe('spans', () => {
  it('finds every value on a line, left to right', () => {
    const model = parse(JSON_DOC)
    expect(valueSpansAt(model, 4).map((span) => textOf(JSON_DOC, span))).toEqual(['30', '60'])
    expect(valueSpansAt(model, 1).map((span) => textOf(JSON_DOC, span))).toEqual(['"krona"'])
    expect(valueSpansAt(model, 6).map((span) => textOf(JSON_DOC, span))).toEqual(['true'])
  })

  it('reports no value on a line that only opens a block', () => {
    const model = parse(JSON_DOC)
    expect(valueSpansAt(model, 2)).toEqual([])
  })

  it('covers a whole block, and just the line when there is none', () => {
    const model = parse(JSON_DOC)
    expect(textOf(JSON_DOC, blockSpanAt(model, 2) as { start: number; end: number })).toBe(
      [
        '  "server": {',
        '    "host": "0.0.0.0",',
        '    "timeouts": { "read": 30, "write": 60 }',
        '  },',
      ].join('\n'),
    )
    expect(textOf(JSON_DOC, lineSpanAt(model, 1) as { start: number; end: number })).toBe(
      '  "name": "krona",',
    )
  })

  it('locates values in a YAML document just the same', () => {
    const yaml = ['name: krona', 'server:', '  host: 0.0.0.0'].join('\n')
    const model = parse(yaml, 'yaml')
    expect(valueSpansAt(model, 0).map((span) => textOf(yaml, span))).toEqual(['krona'])
  })
})

describe('removeBlockEdit', () => {
  it('removes an entry along with its line break', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 1)
    expect(edit).toBeDefined()
    if (!edit) return
    expect(applyEdit(JSON_DOC, edit).source).toBe(
      [
        '{',
        '  "server": {',
        '    "host": "0.0.0.0",',
        '    "timeouts": { "read": 30, "write": 60 }',
        '  },',
        '  "last": true',
        '}',
      ].join('\n'),
    )
  })

  it('removes a whole block, not just the line that opens it', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 2)
    expect(edit).toBeDefined()
    if (!edit) return
    expect(applyEdit(JSON_DOC, edit).source).toBe(
      ['{', '  "name": "krona",', '  "last": true', '}'].join('\n'),
    )
  })

  it('takes the dangling comma with the last entry, leaving valid JSON', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 6)
    expect(edit).toBeDefined()
    if (!edit) return
    const next = applyEdit(JSON_DOC, edit).source
    expect(next).not.toMatch(/,\s*}\s*$/)
    expect(parse(next).diagnostics).toEqual([])
  })

  it('leaves the neighbours alone when the entry is not the last one', () => {
    const model = parse(JSON_DOC)
    const edit = removeBlockEdit(model, 3)
    expect(edit).toBeDefined()
    if (!edit) return
    expect(parse(applyEdit(JSON_DOC, edit).source).diagnostics).toEqual([])
  })
})

describe('duplicateBlockEdit', () => {
  it('repeats an entry below itself, keeping the list valid', () => {
    const model = parse(JSON_DOC)
    const copy = duplicateBlockEdit(model, 1)
    expect(copy).toBeDefined()
    if (!copy) return
    const next = applyEdit(JSON_DOC, copy.edit).source
    expect(next.split('\n').slice(0, 3)).toEqual(['{', '  "name": "krona",', '  "name": "krona",'])
    expect(parse(next).diagnostics).toEqual([])
    expect(copy.line).toBe(2)
    expect(copy.text).toBe('  "name": "krona",')
  })

  it('gives the original the comma it now needs when the entry was last', () => {
    const model = parse(JSON_DOC)
    const copy = duplicateBlockEdit(model, 6)
    expect(copy).toBeDefined()
    if (!copy) return
    const next = applyEdit(JSON_DOC, copy.edit).source
    expect(next.split('\n').slice(-3)).toEqual(['  "last": true,', '  "last": true', '}'])
    expect(parse(next).diagnostics).toEqual([])
  })

  it('repeats a whole block, not just its opening line', () => {
    const model = parse(JSON_DOC)
    const copy = duplicateBlockEdit(model, 2)
    expect(copy).toBeDefined()
    if (!copy) return
    const next = applyEdit(JSON_DOC, copy.edit).source
    expect(next.split('\n').filter((line) => line === '  "server": {')).toHaveLength(2)
    expect(parse(next).diagnostics).toEqual([])
    expect(copy.line).toBe(6)
  })

  it('adds no separator in a format that has none', () => {
    const yaml = ['name: krona', 'server:', '  host: 0.0.0.0'].join('\n')
    const model = parse(yaml, 'yaml')
    const copy = duplicateBlockEdit(model, 0)
    expect(copy).toBeDefined()
    if (!copy) return
    expect(applyEdit(yaml, copy.edit).source).toBe(
      ['name: krona', 'name: krona', 'server:', '  host: 0.0.0.0'].join('\n'),
    )
  })
})

describe('minimalEdit', () => {
  it('narrows to the span that actually differs', () => {
    expect(minimalEdit('abcdef', 'abXYef')).toEqual({ start: 2, end: 4, text: 'XY' })
    expect(minimalEdit('abc', 'abc')).toEqual({ start: 3, end: 3, text: '' })
  })

  it('round-trips through applyEdit', () => {
    const before = '{\n  "a": 1\n}'
    const after = '{\n  "a": 2,\n  "b": 3\n}'
    expect(applyEdit(before, minimalEdit(before, after)).source).toBe(after)
  })
})

describe('formattedEdit', () => {
  it('shapes a block typed on one line into the file\u2019s own layout', () => {
    const model = parse(JSON_DOC)
    const span = blockSpanAt(model, 2)
    expect(span).toBeDefined()
    if (!span) return
    // What the block editor opens with, minus its line breaks and spacing —
    // the separator is part of the text it hands the reader, so it comes back.
    const typed = '  "server": {"host":"127.0.0.1","port":8080},'
    const edit = formattedEdit(model, { start: span.start, end: span.end, text: typed }, true)
    const next = applyEdit(JSON_DOC, edit).source
    expect(next.split('\n').slice(1, 6)).toEqual([
      '  "name": "krona",',
      '  "server": {',
      '    "host": "127.0.0.1",',
      '    "port": 8080',
      '  },',
    ])
    expect(parse(next).diagnostics).toEqual([])
  })

  it('leaves the edit alone when the provider\u2019s formatter throws', () => {
    registerFormat({
      ...PLAIN,
      id: 'throwfmt',
      format: () => {
        throw new Error('nope')
      },
    })
    const model = parseDocument('a b', 'throwfmt')
    const edit = { start: 1, end: 2, text: '-' }
    expect(formattedEdit(model, edit, true)).toBe(edit)
    unregisterFormat('throwfmt')
  })

  it('ignores a replacement that points outside the document', () => {
    registerFormat({
      ...PLAIN,
      id: 'wildfmt',
      format: () => [
        { start: 10, end: 20, text: 'X' },
        { start: -1, end: 0, text: 'Y' },
      ],
    })
    const model = parseDocument('a b', 'wildfmt')
    const edit = { start: 1, end: 2, text: '-' }
    expect(formattedEdit(model, edit, true)).toBe(edit)
    unregisterFormat('wildfmt')
  })

  it('is one edit, so one undo takes the formatting with it', () => {
    const model = parse(JSON_DOC)
    const span = blockSpanAt(model, 2)
    if (!span) return
    const edit = formattedEdit(
      model,
      { start: span.start, end: span.end, text: '  "server": {"host":"x"},' },
      true,
    )
    const applied = applyEdit(JSON_DOC, edit)
    expect(applyEdit(applied.source, applied.inverse).source).toBe(JSON_DOC)
  })

  it('indents text pasted flush against the margin to where it belongs', () => {
    const model = parse(JSON_DOC)
    const span = blockSpanAt(model, 2)
    expect(span).toBeDefined()
    if (!span) return
    const edit = formattedEdit(
      model,
      { start: span.start, end: span.end, text: '"server":{"host":"a","port":1},' },
      true,
    )
    const next = applyEdit(JSON_DOC, edit).source
    expect(next.split('\n').slice(2, 6)).toEqual([
      '  "server": {',
      '    "host": "a",',
      '    "port": 1',
      '  },',
    ])
    expect(parse(next).diagnostics).toEqual([])
  })

  it('leaves a value edited in place on its own line', () => {
    const model = parse(JSON_DOC)
    const spans = valueSpansAt(model, 4)
    const first = spans[0]
    expect(first).toBeDefined()
    if (!first) return
    const edit = formattedEdit(model, { start: first.start, end: first.end, text: '45' }, false)
    const next = applyEdit(JSON_DOC, edit).source
    expect(next.split('\n')[4]).toBe('    "timeouts": { "read": 45, "write": 60 }')
  })

  it('hands the edit back untouched for a format with no formatter', () => {
    const yaml = ['name: krona', 'server:', '  host: 0.0.0.0'].join('\n')
    const model = parse(yaml, 'yaml')
    const edit = { start: 0, end: 4, text: 'title' }
    expect(formattedEdit(model, edit, true)).toBe(edit)
  })
})
