import { pathSegmentOf } from '../model/path'
import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  FoldRange,
  FormatProvider,
  LineStates,
  ResolvedParseOptions,
  Token,
} from '../model/types'
import { classifyScalar, indentOf, isBlank, push, scanQuoted } from './shared'

const IN_BASIC_MULTILINE = 1 << 0
const IN_LITERAL_MULTILINE = 1 << 1
const IN_CONTINUATION = 1 << 2

interface Header {
  readonly path: readonly string[]
  readonly isArrayTable: boolean
  readonly start: number
  readonly end: number
}

/**
 * Parses a `[table]` / `[[array of tables]]` header, honouring quoted key
 * segments such as `["weird.key"]`. Returns undefined for any other line.
 */
/**
 * Splits a key into its dotted parts, honouring quoted ones.
 *
 * `a.b = 1` and `[a] b = 1` name the same value in TOML, so a dotted key has to
 * contribute the same parts a header would.
 */
function splitDottedKey(text: string): string[] {
  const parts: string[] = []
  let part = ''
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      const end = scanQuoted(text, i, c === 34)
      part += text.slice(i + 1, Math.max(i + 1, end - 1))
      i = end - 1
      continue
    }
    if (c === 46 /* . */) {
      parts.push(part.trim())
      part = ''
      continue
    }
    part += text[i]
  }
  parts.push(part.trim())
  return parts
}

function parseHeader(text: string): Header | undefined {
  const start = indentOf(text)
  if (text.charCodeAt(start) !== 91 /* [ */) return undefined
  const isArrayTable = text.charCodeAt(start + 1) === 91
  let i = start + (isArrayTable ? 2 : 1)
  const path: string[] = []
  let segment = ''
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      const end = scanQuoted(text, i, c === 34)
      segment += text.slice(i + 1, Math.max(i + 1, end - 1))
      i = end
      continue
    }
    if (c === 46 /* . */) {
      path.push(segment.trim())
      segment = ''
      i++
      continue
    }
    if (c === 93 /* ] */) {
      path.push(segment.trim())
      i += isArrayTable ? 2 : 1
      return { path, isArrayTable, start, end: i }
    }
    segment += text[i]
    i++
  }
  return undefined
}

function isPrefix(parent: readonly string[], child: readonly string[]): boolean {
  if (parent.length >= child.length) return false
  for (let i = 0; i < parent.length; i++) if (parent[i] !== child[i]) return false
  return true
}

/** Index of the last line at or before `from` that carries content. */
function lastContentLine(lines: readonly string[], from: number, floor: number): number {
  let i = from
  while (i > floor && isBlank(lines[i] ?? '')) i--
  return i
}

interface OpenSection {
  readonly path: readonly string[]
  readonly startLine: number
  readonly level: number
  /** Direct key assignments plus child tables, for the collapsed placeholder. */
  childCount: number
}

function analyze(
  _source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const states: LineStates = new Uint8Array(lines.length)
  const segments: (string | undefined)[] = new Array(lines.length)
  const sections: OpenSection[] = []
  const { maxFoldRanges } = options.limits

  let multiline: 'basic' | 'literal' | undefined
  let multilineStart = -1
  let bracketDepth = 0
  let continuationStart = -1

  const emit = (range: FoldRange): void => {
    if (ranges.length < maxFoldRanges) ranges.push(range)
  }

  const closeSections = (untilPath: readonly string[] | undefined, endLine: number): void => {
    while (sections.length > 0) {
      const top = sections[sections.length - 1] as OpenSection
      if (untilPath && isPrefix(top.path, untilPath)) break
      sections.pop()
      const end = lastContentLine(lines, endLine, top.startLine)
      if (end > top.startLine) {
        emit({
          startLine: top.startLine,
          endLine: end,
          level: top.level,
          kind: 'section',
          summary: '{…}',
          childCount: top.childCount,
        })
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ''

    if (multiline !== undefined) {
      states[i] = multiline === 'basic' ? IN_BASIC_MULTILINE : IN_LITERAL_MULTILINE
      const delimiter = multiline === 'basic' ? '"""' : "'''"
      if (text.includes(delimiter)) {
        if (i > multilineStart) {
          emit({ startLine: multilineStart, endLine: i, level: sections.length, kind: 'scalar' })
        }
        multiline = undefined
        multilineStart = -1
      }
      continue
    }

    if (bracketDepth > 0) {
      states[i] = IN_CONTINUATION
      bracketDepth = scanBrackets(text, bracketDepth)
      if (bracketDepth === 0) {
        if (i > continuationStart) {
          emit({
            startLine: continuationStart,
            endLine: i,
            level: sections.length,
            kind: 'array',
            summary: '[…]',
          })
        }
        continuationStart = -1
      }
      continue
    }

    if (isBlank(text)) continue
    const first = text.charCodeAt(indentOf(text))
    if (first === 35 /* # */) continue

    const header = parseHeader(text)
    if (header) {
      closeSections(header.path, i - 1)
      const level = sections.length
      const parent = sections[sections.length - 1]
      if (parent) parent.childCount++
      // Only the part this header adds: the rest already comes from the
      // sections it nests inside. A header with none above it names the lot.
      const owned =
        parent && isPrefix(parent.path, header.path)
          ? header.path.slice(parent.path.length)
          : header.path
      segments[i] = pathSegmentOf(owned)
      sections.push({ path: header.path, startLine: i, level, childCount: 0 })
      continue
    }

    const section = sections[sections.length - 1]
    const keyStart = indentOf(text)
    const assignment = findAssignment(text, keyStart)
    if (assignment !== -1) {
      if (section) section.childCount++
      segments[i] = pathSegmentOf(
        splitDottedKey(text.slice(keyStart, trimEnd(text, keyStart, assignment))),
      )
    }

    const opened = openMultiline(text)
    if (opened) {
      multiline = opened
      multilineStart = i
      states[i] = 0
      continue
    }

    const depth = scanBrackets(text, 0)
    if (depth > 0) {
      bracketDepth = depth
      continuationStart = i
    }
  }

  closeSections(undefined, lines.length - 1)
  if (multiline !== undefined && multilineStart >= 0 && lines.length - 1 > multilineStart) {
    emit({ startLine: multilineStart, endLine: lines.length - 1, level: 0, kind: 'scalar' })
  }
  if (bracketDepth > 0 && continuationStart >= 0 && lines.length - 1 > continuationStart) {
    emit({ startLine: continuationStart, endLine: lines.length - 1, level: 0, kind: 'array' })
  }

  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)
  return { foldingRanges: ranges, lineStates: states, pathSegments: segments }
}

/** Returns the bracket depth at the end of the line, skipping strings and comments. */
function scanBrackets(text: string, depth: number): number {
  let d = depth
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      i = scanQuoted(text, i, c === 34) - 1
      continue
    }
    if (c === 35 /* # */) break
    if (c === 91 || c === 123) d++
    else if (c === 93 || c === 125) d = Math.max(0, d - 1)
  }
  return d
}

/** Detects an unterminated `"""` / `'''` opener on a value line. */
function openMultiline(text: string): 'basic' | 'literal' | undefined {
  const basic = text.indexOf('"""')
  const literal = text.indexOf("'''")
  if (basic === -1 && literal === -1) return undefined
  const kind: 'basic' | 'literal' =
    basic !== -1 && (literal === -1 || basic < literal) ? 'basic' : 'literal'
  const delimiter = kind === 'basic' ? '"""' : "'''"
  const first = kind === 'basic' ? basic : literal
  return text.indexOf(delimiter, first + 3) === -1 ? kind : undefined
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  const state = states?.[lineIndex] ?? 0

  if ((state & (IN_BASIC_MULTILINE | IN_LITERAL_MULTILINE)) !== 0) {
    push(tokens, 'string', 0, text.length)
    return tokens
  }

  let i = indentOf(text)
  if (i >= text.length) return tokens

  if (text.charCodeAt(i) === 35 /* # */) {
    push(tokens, 'comment', i, text.length)
    return tokens
  }

  const header = (state & IN_CONTINUATION) === 0 ? parseHeader(text) : undefined
  if (header) {
    push(tokens, 'section', header.start, header.end)
    scanValue(text, header.end, tokens)
    return tokens
  }

  if ((state & IN_CONTINUATION) === 0) {
    const eq = findAssignment(text, i)
    if (eq !== -1) {
      push(tokens, 'key', i, trimEnd(text, i, eq))
      push(tokens, 'punctuation', eq, eq + 1)
      i = eq + 1
    }
  }
  scanValue(text, i, tokens)
  return tokens
}

/** Index of the top-level `=` on a line, or -1. */
function findAssignment(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      i = scanQuoted(text, i, c === 34) - 1
      continue
    }
    if (c === 35) return -1
    if (c === 61 /* = */) return i
    if (c === 91 || c === 123) return -1
  }
  return -1
}

function trimEnd(text: string, start: number, end: number): number {
  let e = end
  while (e > start) {
    const c = text.charCodeAt(e - 1)
    if (c !== 32 && c !== 9) break
    e--
  }
  return e
}

/** Tokenizes the value part of a line: strings, numbers, literals, punctuation. */
function scanValue(text: string, from: number, tokens: Token[]): void {
  let i = from
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (c === 32 || c === 9) {
      i++
      continue
    }
    if (c === 35 /* # */) {
      push(tokens, 'comment', i, text.length)
      return
    }
    if (c === 34 || c === 39) {
      const end = scanQuoted(text, i, c === 34)
      push(tokens, 'string', i, end)
      i = end
      continue
    }
    if (c === 91 || c === 93 || c === 123 || c === 125 || c === 44 || c === 61) {
      push(tokens, 'punctuation', i, i + 1)
      i++
      continue
    }
    const start = i
    while (i < text.length) {
      const cc = text.charCodeAt(i)
      if (cc === 32 || cc === 9 || cc === 44 || cc === 93 || cc === 125 || cc === 35) break
      i++
    }
    const word = text.slice(start, i)
    // Inline-table keys look like bare words followed by `=`; the `=` branch
    // above will re-classify them on the next iteration.
    push(tokens, nextNonSpaceIsEquals(text, i) ? 'key' : classifyScalar(word), start, i)
  }
}

function nextNonSpaceIsEquals(text: string, from: number): boolean {
  let i = from
  while (i < text.length && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) i++
  return text.charCodeAt(i) === 61
}

function detect(_source: string, lines: readonly string[]): number {
  let headers = 0
  let assignments = 0
  const scanned = Math.min(lines.length, 200)
  for (let i = 0; i < scanned; i++) {
    const text = lines[i] ?? ''
    if (isBlank(text)) continue
    if (parseHeader(text)) headers++
    else if (findAssignment(text, indentOf(text)) !== -1) assignments++
  }
  if (headers === 0 && assignments === 0) return 0
  return headers > 0 ? 0.7 : 0.3
}

/**
 * TOML: folding follows `[table]` and `[[array of tables]]` headers, with
 * nesting derived from dotted key paths, plus multi-line strings and
 * multi-line inline arrays.
 *
 * Only sections and tokens are needed, so Krona scans TOML itself rather than
 * adding a parser dependency — and never builds values from the document.
 */
export const tomlProvider: FormatProvider = {
  id: 'toml',
  displayName: 'TOML',
  extensions: ['.toml'],
  detect,
  analyze,
  tokenize,
}

registerFormat(tomlProvider)
