import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  FoldRange,
  FormatProvider,
  ResolvedParseOptions,
  Token,
} from '../model/types'
import { classifyScalar, indentOf, isBlank, push, scanQuoted } from './shared'

interface Header {
  readonly path: readonly string[]
  readonly start: number
  readonly end: number
}

/** Parses a `[section]` header. Dotted names nest, as in `[server.tls]`. */
function parseHeader(text: string): Header | undefined {
  const start = indentOf(text)
  if (text.charCodeAt(start) !== 91 /* [ */) return undefined
  const close = text.indexOf(']', start + 1)
  if (close === -1) return undefined
  const name = text.slice(start + 1, close).trim()
  if (name.length === 0) return undefined
  return { path: name.split('.').map((s) => s.trim()), start, end: close + 1 }
}

function isComment(text: string, at: number): boolean {
  const c = text.charCodeAt(at)
  return c === 59 /* ; */ || c === 35 /* # */
}

function isPrefix(parent: readonly string[], child: readonly string[]): boolean {
  if (parent.length >= child.length) return false
  for (let i = 0; i < parent.length; i++) if (parent[i] !== child[i]) return false
  return true
}

function lastContentLine(lines: readonly string[], from: number, floor: number): number {
  let i = from
  while (i > floor && isBlank(lines[i] ?? '')) i--
  return i
}

interface OpenSection {
  readonly path: readonly string[]
  readonly startLine: number
  readonly level: number
  /** Direct keys plus child sections, for the collapsed placeholder. */
  childCount: number
}

function analyze(
  _source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const open: OpenSection[] = []
  const { maxFoldRanges } = options.limits

  const close = (untilPath: readonly string[] | undefined, endLine: number): void => {
    while (open.length > 0) {
      const top = open[open.length - 1] as OpenSection
      if (untilPath && isPrefix(top.path, untilPath)) break
      open.pop()
      const end = lastContentLine(lines, endLine, top.startLine)
      if (end > top.startLine && ranges.length < maxFoldRanges) {
        ranges.push({
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
    if (isBlank(text)) continue
    const at = indentOf(text)
    if (isComment(text, at)) continue
    const header = parseHeader(text)
    if (!header) {
      const section = open[open.length - 1]
      if (section && findSeparator(text, at) !== -1) section.childCount++
      continue
    }
    close(header.path, i - 1)
    const parent = open[open.length - 1]
    if (parent) parent.childCount++
    open.push({ path: header.path, startLine: i, level: open.length, childCount: 0 })
  }
  close(undefined, lines.length - 1)

  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)
  return { foldingRanges: ranges }
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = indentOf(text)
  if (i >= text.length) return tokens

  if (isComment(text, i)) {
    push(tokens, 'comment', i, text.length)
    return tokens
  }

  const header = parseHeader(text)
  if (header) {
    push(tokens, 'section', header.start, header.end)
    const rest = skipSpace(text, header.end)
    if (rest < text.length && isComment(text, rest)) {
      push(tokens, 'comment', rest, text.length)
    }
    return tokens
  }

  // `export FOO=bar` is idiomatic in .env files; the keyword is not the key.
  if (text.startsWith('export ', i)) i += 7
  i = skipSpace(text, i)

  const separator = findSeparator(text, i)
  if (separator === -1) {
    push(tokens, 'key', i, text.length)
    return tokens
  }

  push(tokens, 'key', i, trimEnd(text, i, separator))
  push(tokens, 'punctuation', separator, separator + 1)

  let v = skipSpace(text, separator + 1)
  if (v >= text.length) return tokens

  if (text.charCodeAt(v) === 34 || text.charCodeAt(v) === 39) {
    const end = scanQuoted(text, v, text.charCodeAt(v) === 34)
    push(tokens, 'string', v, end)
    v = skipSpace(text, end)
    if (v < text.length && isComment(text, v)) push(tokens, 'comment', v, text.length)
    return tokens
  }

  let end = text.length
  for (let j = v; j < text.length; j++) {
    // An inline comment must be preceded by whitespace, so `pass#word` stays a value.
    if (isComment(text, j) && (text.charCodeAt(j - 1) === 32 || text.charCodeAt(j - 1) === 9)) {
      end = j
      break
    }
  }
  const value = text.slice(v, trimEnd(text, v, end))
  push(tokens, classifyScalar(value), v, trimEnd(text, v, end))
  if (end < text.length) push(tokens, 'comment', end, text.length)
  return tokens
}

function skipSpace(text: string, from: number): number {
  let i = from
  while (i < text.length && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) i++
  return i
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

function findSeparator(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 61 /* = */ || c === 58 /* : */) return i
  }
  return -1
}

function detect(_source: string, lines: readonly string[]): number {
  let headers = 0
  let assignments = 0
  let other = 0
  const scanned = Math.min(lines.length, 200)
  for (let i = 0; i < scanned; i++) {
    const text = lines[i] ?? ''
    if (isBlank(text)) continue
    const at = indentOf(text)
    if (isComment(text, at)) continue
    if (parseHeader(text)) headers++
    else if (findSeparator(text, at) !== -1 && at === 0) assignments++
    else other++
  }
  if (assignments + headers === 0) return 0
  if (other > assignments) return 0
  return headers > 0 ? 0.6 : 0.35
}

/**
 * INI and dotenv. `[section]` headers fold (dotted names nest); a `.env` file
 * has no sections and therefore no folding — just highlighting, by design.
 */
export const iniProvider: FormatProvider = {
  id: 'ini',
  displayName: 'INI / .env',
  extensions: ['.ini', '.cfg', '.conf', '.env', '.properties', '.editorconfig'],
  detect,
  analyze,
  tokenize,
}

registerFormat(iniProvider)
