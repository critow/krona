import { pathSegmentOf } from '../model/path'
import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  Diagnostic,
  FoldRange,
  FormatProvider,
  LineStates,
  ResolvedParseOptions,
  Token,
  TokenType,
} from '../model/types'
import { indentOf, push } from './shared'

/** Bit set on a line that begins inside an unterminated block comment. */
const IN_COMMENT = 1
/** Bit set on every line of a heredoc, its terminator included. */
const IN_HEREDOC = 2

const MAX_REPORTED_ERRORS = 20

/** What the line scanner tells the analyzer about the structure it walked. */
type Event =
  | { readonly kind: 'open'; readonly bracket: 'block' | 'object' | 'array' }
  | { readonly kind: 'close'; readonly bracket: 'block' | 'object' | 'array' }
  | { readonly kind: 'header'; readonly parts: readonly string[] }
  | { readonly kind: 'attribute'; readonly name: string }
  | { readonly kind: 'heredoc'; readonly word: string }
  | { readonly kind: 'unterminated'; readonly what: 'comment' | 'string' }

const isDigit = (code: number): boolean => code >= 48 && code <= 57

function isIdentifierChar(code: number): boolean {
  return (
    (code >= 97 && code <= 122) ||
    (code >= 65 && code <= 90) ||
    isDigit(code) ||
    code === 95 /* _ */ ||
    code === 45 /* - */ ||
    code > 127
  )
}

const KEYWORDS: Record<string, TokenType | undefined> = {
  true: 'boolean',
  false: 'boolean',
  null: 'null',
}

/**
 * Scans one line, from the state the line above left behind.
 *
 * One scanner answers both the folding and the highlighting, so a brace inside
 * a comment cannot be a block to one of them and text to the other.
 */
function scanLine(
  text: string,
  state: number,
  tokens: Token[] | null,
  events: Event[] | null,
): number {
  let i = 0
  const emit = (type: TokenType, start: number, end: number) => {
    if (tokens) push(tokens, type, start, end)
  }
  const note = (event: Event) => {
    if (events) events.push(event)
  }

  if ((state & IN_HEREDOC) !== 0) {
    // The analyzer knows which word ends it; painting is all that is left.
    emit('string', indentOf(text), text.length)
    return state
  }

  if ((state & IN_COMMENT) !== 0) {
    const end = text.indexOf('*/')
    if (end === -1) {
      emit('comment', 0, text.length)
      return IN_COMMENT
    }
    emit('comment', 0, end + 2)
    i = end + 2
  }

  /** The words at the head of the line, which name a block or an attribute. */
  const head: string[] = []
  let assigned = false

  while (i < text.length) {
    const code = text.charCodeAt(i)

    if (code === 32 || code === 9 || code === 13) {
      i++
      continue
    }

    if (code === 35 /* # */ || (code === 47 && text.charCodeAt(i + 1) === 47)) {
      emit('comment', i, text.length)
      return 0
    }

    if (code === 47 && text.charCodeAt(i + 1) === 42 /* comment */) {
      const end = text.indexOf('*/', i + 2)
      if (end === -1) {
        emit('comment', i, text.length)
        note({ kind: 'unterminated', what: 'comment' })
        return IN_COMMENT
      }
      emit('comment', i, end + 2)
      i = end + 2
      continue
    }

    if (code === 60 && text.charCodeAt(i + 1) === 60 /* << */) {
      let at = i + 2
      if (text.charCodeAt(at) === 45 /* - */) at++
      const wordEnd = readIdentifier(text, at)
      emit('punctuation', i, at)
      emit('string', at, wordEnd)
      if (wordEnd > at) note({ kind: 'heredoc', word: text.slice(at, wordEnd) })
      i = wordEnd
      continue
    }

    if (code === 34 /* " */) {
      const end = scanString(text, i)
      if (end === -1) {
        emit('string', i, text.length)
        note({ kind: 'unterminated', what: 'string' })
        return 0
      }
      emit('string', i, end)
      // `resource "aws_instance" "web" {` — the labels are part of the header.
      if (!assigned) head.push(text.slice(i + 1, end - 1))
      i = end
      continue
    }

    if (code === 123 || code === 91 /* { [ */) {
      emit('punctuation', i, i + 1)
      // A `{` after an `=` is a value; one after a header opens a block. They
      // fold the same way and read differently, which is the whole difference
      // between `variables = {` and `resource "x" "y" {`.
      const bracket = code === 91 ? 'array' : assigned || head.length === 0 ? 'object' : 'block'
      if (bracket === 'block') note({ kind: 'header', parts: [...head] })
      note({ kind: 'open', bracket })
      head.length = 0
      i++
      continue
    }

    if (code === 125 || code === 93 /* } ] */) {
      emit('punctuation', i, i + 1)
      note({ kind: 'close', bracket: code === 93 ? 'array' : 'object' })
      i++
      continue
    }

    if (code === 61 /* = */) {
      emit('punctuation', i, i + 1)
      if (!assigned && head.length > 0) note({ kind: 'attribute', name: head[0] as string })
      assigned = true
      head.length = 0
      i++
      continue
    }

    if (isDigit(code) || (code === 45 && isDigit(text.charCodeAt(i + 1)))) {
      const start = i
      i = scanNumber(text, i)
      emit('number', start, i)
      continue
    }

    if (isIdentifierChar(code)) {
      const start = i
      i = readIdentifier(text, i)
      const word = text.slice(start, i)
      const keyword = KEYWORDS[word]
      if (keyword) {
        emit(keyword, start, i)
        continue
      }
      if (assigned) {
        // On the value side an identifier is a reference — `var.region`,
        // `each.key` — and painting it as a key would say it declares one.
        continue
      }
      // The first word of a line names what the line introduces; a `.` after it
      // is a dotted attribute name rather than the end of it.
      head.push(word)
      emit(followedBy(text, i, 61 /* = */) ? 'key' : 'section', start, i)
      continue
    }

    emit('punctuation', i, i + 1)
    i++
  }
  return 0
}

function readIdentifier(text: string, from: number): number {
  let i = from
  while (i < text.length && isIdentifierChar(text.charCodeAt(i))) i++
  return i
}

/** Whether the next non-space character is `code`. */
function followedBy(text: string, from: number, code: number): boolean {
  let i = from
  while (i < text.length && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) i++
  return text.charCodeAt(i) === code
}

/** Scans a quoted string, answering with the index past it, or -1 if it runs off. */
function scanString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 92 /* \ */) {
      i++
      continue
    }
    if (code === 34) return i + 1
  }
  return -1
}

function scanNumber(text: string, start: number): number {
  let i = start
  if (text.charCodeAt(i) === 45) i++
  let digits = 0
  let dot = false
  for (; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (isDigit(code)) digits++
    else if (code === 46 && !dot) dot = true
    else break
  }
  return digits > 0 ? i : start + 1
}

interface Frame {
  readonly kind: 'block' | 'object' | 'array'
  readonly startLine: number
  readonly level: number
  count: number
}

function analyze(
  _source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const diagnostics: Diagnostic[] = []
  const states: LineStates = new Uint8Array(lines.length)
  const segments: (string | undefined)[] = new Array(lines.length)
  const stack: Frame[] = []
  const { maxFoldRanges } = options.limits
  const events: Event[] = []
  /** The heredoc being read, its word and the line it opened on. */
  let heredoc: { word: string; line: number } | null = null
  /** The header words seen on this line, waiting for the `{` they belong to. */
  let header: readonly string[] = []
  let state = 0

  const report = (message: string, code: string, line: number) => {
    if (diagnostics.length >= MAX_REPORTED_ERRORS) return
    diagnostics.push({ severity: 'error', code, message, line })
  }

  const fold = (range: FoldRange) => {
    if (ranges.length < maxFoldRanges && range.endLine > range.startLine) ranges.push(range)
  }

  const close = (endLine: number) => {
    const frame = stack.pop()
    if (!frame) return
    fold({
      startLine: frame.startLine,
      endLine,
      level: frame.level,
      kind: frame.kind,
      summary: frame.kind === 'array' ? '[…]' : '{…}',
      childCount: frame.count,
    })
  }

  for (let line = 0; line < lines.length; line++) {
    const text = lines[line] ?? ''

    if (heredoc) {
      states[line] = IN_HEREDOC
      if (text.trim() === heredoc.word) {
        fold({ startLine: heredoc.line, endLine: line, level: stack.length, kind: 'scalar' })
        heredoc = null
      }
      continue
    }

    states[line] = state
    events.length = 0
    state = scanLine(text, state, null, events)

    for (const event of events) {
      const top = stack[stack.length - 1]
      switch (event.kind) {
        case 'header':
          header = event.parts
          break
        case 'attribute':
          if (top) top.count++
          if (segments[line] === undefined) segments[line] = pathSegmentOf([event.name])
          break
        case 'open':
          if (event.bracket === 'block') {
            if (top) top.count++
            // `resource "aws_instance" "web"` is one path: the type and the
            // labels together are what names this block among its siblings.
            if (segments[line] === undefined && header.length > 0) {
              segments[line] = pathSegmentOf([...header])
            }
          }
          header = []
          stack.push({ kind: event.bracket, startLine: line, level: stack.length, count: 0 })
          break
        case 'close':
          if (stack.length === 0) {
            report('Unexpected closing bracket', 'hcl-unexpected-close', line)
            break
          }
          close(line)
          break
        case 'heredoc':
          heredoc = { word: event.word, line }
          break
        case 'unterminated':
          report(
            event.what === 'comment' ? 'Unterminated comment' : 'Unterminated string',
            `hcl-unterminated-${event.what}`,
            line,
          )
          break
      }
    }
  }

  if (heredoc)
    report(`Unterminated heredoc <<${heredoc.word}`, 'hcl-unterminated-heredoc', heredoc.line)
  if (stack.length > 0) report('Unclosed block', 'hcl-unclosed', stack[0]?.startLine ?? 0)
  while (stack.length > 0) close(lines.length - 1)
  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)

  return { foldingRanges: ranges, diagnostics, lineStates: states, pathSegments: segments }
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  scanLine(text, states?.[lineIndex] ?? 0, tokens, null)
  return tokens
}

/**
 * Confidence that this is HCL.
 *
 * A block header — a word, optional quoted labels, then a `{` — is the shape
 * nothing else here has: JSON opens with a brace of its own, and TOML and INI
 * have no braces to open at all.
 */
function detect(_source: string, lines: readonly string[]): number {
  const scanned = Math.min(lines.length, 200)
  let headers = 0
  let assignments = 0
  const events: Event[] = []
  let state = 0

  for (let i = 0; i < scanned; i++) {
    events.length = 0
    state = scanLine(lines[i] ?? '', state, null, events)
    for (const event of events) {
      if (event.kind === 'header' && event.parts.length > 0) headers++
      else if (event.kind === 'attribute') assignments++
    }
  }
  if (headers === 0) return 0
  return assignments > 0 ? 0.9 : 0.6
}

/**
 * HCL, the language Terraform and friends are written in: blocks with labels,
 * attributes, heredocs, and all three kinds of comment.
 *
 * Hand-written and with no dependency behind it, like every provider here that
 * could be. Krona needs the shape of a file and the class of each span, never
 * its value — an expression is highlighted, never evaluated.
 */
export const hclProvider: FormatProvider = {
  id: 'hcl',
  displayName: 'HCL / Terraform',
  extensions: ['.hcl', '.tf', '.tfvars', '.nomad'],
  detect,
  analyze,
  tokenize,
}

registerFormat(hclProvider)
