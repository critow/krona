import { describe, expect, it } from 'vitest'
import '../formats/json'
import '../formats/yaml'
import { parseDocument } from './document'
import { allCollapsed, collapsedToDepth, nestingLevelAt, visibleLines } from './folding'

const JSON_DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "localhost",',
  '    "port": 8080',
  '  },',
  '  "tail": 1',
  '}',
].join('\n')

const doc = () => parseDocument(JSON_DOC, 'json')

describe('collapsedToDepth', () => {
  it('collapses nothing without a depth, which is not the same as depth zero', () => {
    const model = doc()
    expect(collapsedToDepth(model, undefined).size).toBe(0)
    // Zero folds even the outermost range, so the whole document is one line.
    expect([...collapsedToDepth(model, 0)]).toEqual([0, 2])
  })

  it('keeps the levels above the depth open', () => {
    // The object at line 2 is one level in, so a depth of 1 folds it and
    // leaves the document's own braces open.
    expect([...collapsedToDepth(doc(), 1)]).toEqual([2])
  })
})

describe('visibleLines', () => {
  it('is every line when nothing is collapsed', () => {
    const model = doc()
    expect(visibleLines(model, new Set())).toHaveLength(model.lines.length)
  })

  it('keeps the line that opens a collapsed range and drops the rest of it', () => {
    // Lines 3 to 5 belong to the server object, whose header stays.
    expect(visibleLines(doc(), new Set([2]))).toEqual([0, 1, 2, 6, 7])
  })

  it('does not pay twice for a range nested inside a collapsed one', () => {
    const model = doc()
    // The inner range is collapsed too, but the outer jump skips over it.
    expect(visibleLines(model, new Set([0, 2]))).toEqual([0])
  })

  it('folds the whole document down to its openers', () => {
    const model = doc()
    expect(visibleLines(model, allCollapsed(model))).toEqual([0])
  })
})

describe('nestingLevelAt', () => {
  it('counts from one, with the opener at its parent level', () => {
    const model = doc()
    const levels = model.lines.map((_, line) => nestingLevelAt(model, line))
    expect(levels).toEqual([1, 2, 2, 3, 3, 3, 2, 2])
  })

  it('answers the same on a second pass, and outside the document', () => {
    const model = doc()
    expect(nestingLevelAt(model, 3)).toBe(3)
    expect(nestingLevelAt(model, 3)).toBe(3)
    expect(nestingLevelAt(model, 999)).toBe(1)
  })

  it('reads the nesting of a format that has no brackets at all', () => {
    const model = parseDocument(
      ['server:', '  tls:', '    ciphers:', '      - AES', 'tail: 1'].join('\n'),
      'yaml',
    )
    const levels = model.lines.map((_, line) => nestingLevelAt(model, line))
    // Indentation is the nesting here, and it is read the same way.
    expect(levels[0]).toBe(1)
    expect(levels[1]).toBeGreaterThan(levels[0] as number)
    expect(levels[3]).toBeGreaterThan(levels[2] as number)
    expect(levels[4]).toBe(1)
  })
})
