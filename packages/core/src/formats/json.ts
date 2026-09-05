import { format as formatJson, visit } from 'jsonc-parser'
import { pathSegmentOf } from '../model/path'
import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  Diagnostic,
  FoldRange,
  FormatProvider,
  FormatRequest,
  FormatSpan,
  LineStates,
  ResolvedParseOptions,
  TextReplacement,
  Token,
} from '../model/types'

/** Bit set on a line that begins inside an unterminated block comment. */
const IN_BLOCK_COMMENT = 1

const MAX_REPORTED_ERRORS = 20

interface Frame {
  readonly kind: 'object' | 'array'
  readonly startLine: number
  readonly level: number
  count: number
}

function analyze(
  source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const diagnostics: Diagnostic[] = []
  const states: LineStates = new Uint8Array(lines.length)
  const segments: (string | undefined)[] = new Array(lines.length)
  const stack: Frame[] = []
  const { maxFoldRanges } = options.limits

  /**
   * Records what an entry contributes to a path, and counts it in its parent.
   *
   * Only the first entry on a line is recorded: a path names a line, and
   * `"timeouts": { "read": 30, "write": 60 }` is one line however many entries
   * it holds.
   */
  const noteChild = (startLine: number): void => {
    const top = stack[stack.length - 1]
    if (top?.kind !== 'array') return
    if (segments[startLine] === undefined) segments[startLine] = pathSegmentOf([top.count])
    top.count++
  }

  const lastLine = lines.length - 1
  const close = (rawEndLine: number): void => {
    const frame = stack.pop()
    if (!frame || ranges.length >= maxFoldRanges) return
    // A document ending in a newline makes the scanner report a closing brace on
    // a line the model does not have; clamp so the range stays inside the file.
    const endLine = Math.min(rawEndLine, lastLine)
    if (endLine <= frame.startLine) return
    ranges.push({
      startLine: frame.startLine,
      endLine,
      level: frame.level,
      kind: frame.kind,
      summary: frame.kind === 'object' ? '{…}' : '[…]',
      childCount: frame.count,
    })
  }

  visit(
    source,
    {
      onObjectBegin: (_offset, _length, startLine) => {
        noteChild(startLine)
        stack.push({ kind: 'object', startLine, level: stack.length, count: 0 })
      },
      onObjectEnd: (_offset, _length, startLine) => close(startLine),
      onArrayBegin: (_offset, _length, startLine) => {
        noteChild(startLine)
        stack.push({ kind: 'array', startLine, level: stack.length, count: 0 })
      },
      onArrayEnd: (_offset, _length, startLine) => close(startLine),
      onObjectProperty: (property, _offset, _length, startLine) => {
        const top = stack[stack.length - 1]
        if (top?.kind === 'object') top.count++
        if (segments[startLine] === undefined) segments[startLine] = pathSegmentOf([property])
      },
      onLiteralValue: (_value, _offset, _length, startLine) => noteChild(startLine),
      onComment: (offset, length, startLine) => {
        // Only block comments carry state across lines; mark every line the
        // comment continues onto so a single line can be tokenized in isolation.
        let line = startLine
        for (let i = offset; i < offset + length && i < source.length; i++) {
          const ch = source.charCodeAt(i)
          if (ch === 10) {
            line++
            if (line < states.length) states[line] = IN_BLOCK_COMMENT
          }
        }
      },
      onError: (error, _offset, _length, startLine) => {
        if (diagnostics.length >= MAX_REPORTED_ERRORS) return
        diagnostics.push({
          severity: 'error',
          code: `json-${error}`,
          message: describeError(error),
          line: startLine,
        })
      },
    },
    { allowTrailingComma: true, disallowComments: false, allowEmptyContent: true },
  )

  // Unterminated containers still fold to the end of the file, which is what an
  // editor does while you are half way through typing one.
  while (stack.length > 0) close(lastLine)
  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)

  return { foldingRanges: ranges, diagnostics, lineStates: states, pathSegments: segments }
}

const ERROR_NAMES: Record<number, string> = {
  1: 'Invalid symbol',
  2: 'Invalid number format',
  3: 'Property name expected',
  4: 'Value expected',
  5: 'Colon expected',
  6: 'Comma expected',
  7: 'Closing brace expected',
  8: 'Closing bracket expected',
  9: 'End of file expected',
  10: 'Invalid comment token',
  11: 'Unexpected end of comment',
  12: 'Unexpected end of string',
  13: 'Unexpected end of number',
  14: 'Invalid unicode escape',
  15: 'Invalid escape character',
  16: 'Invalid character',
}

function describeError(code: number): string {
  return ERROR_NAMES[code] ?? `JSON parse error ${code}`
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

function isWordChar(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90)
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  let i = 0
  const inBlockComment = ((states?.[lineIndex] ?? 0) & IN_BLOCK_COMMENT) !== 0

  if (inBlockComment) {
    const end = text.indexOf('*/')
    if (end === -1) {
      if (text.length > 0) tokens.push({ type: 'comment', start: 0, end: text.length })
      return tokens
    }
    tokens.push({ type: 'comment', start: 0, end: end + 2 })
    i = end + 2
  }

  while (i < text.length) {
    const code = text.charCodeAt(i)

    if (code === 32 || code === 9) {
      i++
      continue
    }

    if (code === 34 /* " */) {
      const start = i
      i++
      while (i < text.length) {
        const c = text.charCodeAt(i)
        if (c === 92 /* \ */) {
          i += 2
          continue
        }
        i++
        if (c === 34) break
      }
      if (i > text.length) i = text.length
      // A string immediately followed by `:` is a property name. Keys split
      // across lines are vanishingly rare and simply render as strings.
      let j = i
      while (j < text.length && (text.charCodeAt(j) === 32 || text.charCodeAt(j) === 9)) j++
      tokens.push({ type: text.charCodeAt(j) === 58 ? 'key' : 'string', start, end: i })
      continue
    }

    if (code === 47 /* / */) {
      const next = text.charCodeAt(i + 1)
      if (next === 47) {
        tokens.push({ type: 'comment', start: i, end: text.length })
        return tokens
      }
      if (next === 42 /* * */) {
        const end = text.indexOf('*/', i + 2)
        if (end === -1) {
          tokens.push({ type: 'comment', start: i, end: text.length })
          return tokens
        }
        tokens.push({ type: 'comment', start: i, end: end + 2 })
        i = end + 2
        continue
      }
      i++
      continue
    }

    if (isDigit(code) || (code === 45 /* - */ && isDigit(text.charCodeAt(i + 1)))) {
      const start = i
      i++
      while (i < text.length) {
        const c = text.charCodeAt(i)
        if (isDigit(c) || c === 46 || c === 101 || c === 69 || c === 43 || c === 45) i++
        else break
      }
      tokens.push({ type: 'number', start, end: i })
      continue
    }

    if (isWordChar(code)) {
      const start = i
      while (i < text.length && isWordChar(text.charCodeAt(i))) i++
      const word = text.slice(start, i)
      if (word === 'true' || word === 'false') tokens.push({ type: 'boolean', start, end: i })
      else if (word === 'null') tokens.push({ type: 'null', start, end: i })
      continue
    }

    if (code === 123 || code === 125 || code === 91 || code === 93 || code === 58 || code === 44) {
      tokens.push({ type: 'punctuation', start: i, end: i + 1 })
      i++
      continue
    }

    i++
  }

  return tokens
}

function detect(source: string): number {
  const trimmed = source.trimStart()
  const first = trimmed.charCodeAt(0)
  if (first !== 123 /* { */ && first !== 91 /* [ */) return 0
  const last = source.trimEnd().charCodeAt(source.trimEnd().length - 1)
  return last === 125 || last === 93 ? 0.9 : 0.5
}

/**
 * The indentation the document already uses.
 *
 * Read from the file rather than configured, because reformatting one edited
 * block in a style the rest of the file does not use is worse than not
 * formatting it at all.
 */
function detectIndent(source: string): { tabSize: number; insertSpaces: boolean } {
  const lines = source.split('\n')
  for (const line of lines) {
    if (line.charCodeAt(0) === 9 /* tab */) return { tabSize: 1, insertSpaces: false }
    let spaces = 0
    while (line.charCodeAt(spaces) === 32) spaces++
    // Something has to follow, or a blank line would answer the question.
    if (spaces > 0 && spaces < line.length) {
      return { tabSize: Math.min(spaces, 8), insertSpaces: true }
    }
  }
  return { tabSize: 2, insertSpaces: true }
}

function format(
  source: string,
  span: FormatSpan,
  request: FormatRequest,
): readonly TextReplacement[] {
  const { tabSize, insertSpaces } = detectIndent(source)
  const edits = formatJson(
    source,
    { offset: span.start, length: span.end - span.start },
    {
      tabSize,
      insertSpaces,
      eol: source.includes('\r\n') ? '\r\n' : '\n',
      keepLines: !request.expand,
    },
  )
  return edits.map((edit) => ({
    start: edit.offset,
    end: edit.offset + edit.length,
    text: edit.content,
  }))
}

/**
 * JSON and JSONC (comments and trailing commas allowed).
 *
 * Folding ranges come from `jsonc-parser`'s streaming visitor, so no JavaScript
 * object is ever built from the document — a whole class of prototype-pollution
 * tricks through `__proto__` keys simply does not apply.
 */
export const jsonProvider: FormatProvider = {
  id: 'json',
  displayName: 'JSON / JSONC',
  extensions: ['.json', '.jsonc', '.webmanifest'],
  detect,
  analyze,
  tokenize,
  format,
}

registerFormat(jsonProvider)
