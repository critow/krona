import { LineCounter, parseDocument as parseYamlDocument } from 'yaml'
import { registerFormat } from '../model/registry'
import type {
  AnalysisResult,
  Diagnostic,
  FoldRange,
  FormatProvider,
  LineStates,
  ResolvedParseOptions,
  Token,
} from '../model/types'
import { classifyScalar, indentOf, isBlank, push, scanQuoted } from './shared'

const IN_BLOCK_SCALAR = 1 << 0
const IN_FLOW = 1 << 1

/** Above this size the structural scan still runs, but validation is skipped. */
const MAX_VALIDATED_LENGTH = 1024 * 1024
const MAX_REPORTED_ERRORS = 20

interface OpenBlock {
  readonly indent: number
  readonly startLine: number
}

function analyze(
  source: string,
  lines: readonly string[],
  options: ResolvedParseOptions,
): AnalysisResult {
  const ranges: FoldRange[] = []
  const states: LineStates = new Uint8Array(lines.length)
  const stack: OpenBlock[] = []
  const { maxFoldRanges } = options.limits

  let lastContent = -1
  let scalarIndent = -1
  let scalarStart = -1
  let flowDepth = 0
  let flowStart = -1

  const emit = (range: FoldRange): void => {
    if (ranges.length < maxFoldRanges) ranges.push(range)
  }

  const closeTo = (indent: number, endLine: number): void => {
    while (stack.length > 0 && (stack[stack.length - 1] as OpenBlock).indent >= indent) {
      const block = stack.pop() as OpenBlock
      if (endLine > block.startLine) {
        emit({
          startLine: block.startLine,
          endLine,
          level: stack.length,
          kind: 'block',
        })
      }
    }
  }

  const endScalar = (endLine: number): void => {
    if (scalarStart >= 0 && endLine > scalarStart) {
      emit({ startLine: scalarStart, endLine, level: stack.length, kind: 'scalar' })
    }
    scalarStart = -1
    scalarIndent = -1
  }

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ''
    const blank = isBlank(text)
    const indent = indentOf(text)

    if (scalarIndent >= 0) {
      if (blank || indent > scalarIndent) {
        states[i] = IN_BLOCK_SCALAR
        if (!blank) lastContent = i
        continue
      }
      endScalar(lastContent)
    }

    if (flowDepth > 0) {
      states[i] = IN_FLOW
      if (!blank) lastContent = i
      flowDepth = scanFlow(text, flowDepth)
      if (flowDepth === 0) {
        if (i > flowStart) {
          emit({ startLine: flowStart, endLine: i, level: stack.length, kind: 'array' })
        }
        flowStart = -1
      }
      continue
    }

    if (blank) continue
    // Comment-only lines are transparent: they neither open nor close a block,
    // so a comment flush against the left margin cannot cut a nested block short.
    if (text.charCodeAt(indent) === 35 /* # */) continue
    if (isDocumentMarker(text)) {
      closeTo(0, lastContent)
      lastContent = i
      continue
    }

    closeTo(indent, lastContent)
    lastContent = i

    if (opensBlockScalar(text)) {
      scalarIndent = indent
      scalarStart = i
      continue
    }

    const depth = scanFlow(text, 0)
    if (depth > 0) {
      flowDepth = depth
      flowStart = i
      continue
    }

    stack.push({ indent, startLine: i })
  }

  if (scalarIndent >= 0) endScalar(lastContent)
  if (flowDepth > 0 && flowStart >= 0 && lastContent > flowStart) {
    emit({ startLine: flowStart, endLine: lastContent, level: stack.length, kind: 'array' })
  }
  closeTo(0, lastContent)

  ranges.sort((a, b) => a.startLine - b.startLine || a.level - b.level)
  return { foldingRanges: ranges, lineStates: states, diagnostics: validate(source) }
}

/**
 * Structural problems are reported by the `yaml` parser, which builds a CST and
 * an AST but never resolves aliases into values — so a "billion laughs" file
 * costs no more than its own size.
 */
function validate(source: string): Diagnostic[] {
  if (source.length > MAX_VALIDATED_LENGTH) return []
  const diagnostics: Diagnostic[] = []
  try {
    const lineCounter = new LineCounter()
    const doc = parseYamlDocument(source, {
      lineCounter,
      prettyErrors: false,
      keepSourceTokens: false,
    })
    for (const error of doc.errors) {
      if (diagnostics.length >= MAX_REPORTED_ERRORS) break
      diagnostics.push({
        severity: 'error',
        code: `yaml-${error.code}`,
        message: error.message,
        line: Math.max(0, lineCounter.linePos(error.pos[0]).line - 1),
      })
    }
    for (const warning of doc.warnings) {
      if (diagnostics.length >= MAX_REPORTED_ERRORS) break
      diagnostics.push({
        severity: 'warning',
        code: `yaml-${warning.code}`,
        message: warning.message,
        line: Math.max(0, lineCounter.linePos(warning.pos[0]).line - 1),
      })
    }
  } catch {
    // Validation is a bonus; folding and highlighting must work regardless.
  }
  return diagnostics
}

function isDocumentMarker(text: string): boolean {
  return text.startsWith('---') || text.startsWith('...')
}

/** Bracket depth at end of line, skipping quoted scalars and comments. */
function scanFlow(text: string, depth: number): number {
  let d = depth
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      i = scanQuoted(text, i, c === 34) - 1
      continue
    }
    if (c === 35 /* # */ && (i === 0 || text.charCodeAt(i - 1) === 32)) break
    if (c === 91 || c === 123) d++
    else if (c === 93 || c === 125) d = Math.max(0, d - 1)
  }
  return d
}

/**
 * True for lines whose value is a block scalar indicator (`|`, `>` with the
 * optional chomping/indentation modifiers) — the whole indented block below
 * then folds as one scalar.
 */
function opensBlockScalar(text: string): boolean {
  const body = stripComment(text).trimEnd()
  if (body.length === 0) return false
  let start = body.length - 1
  while (start > 0 && body.charCodeAt(start - 1) !== 32 && body.charCodeAt(start - 1) !== 9) start--
  const chunk = body.slice(start)
  const first = chunk.charCodeAt(0)
  if (first !== 124 /* | */ && first !== 62 /* > */) return false
  for (let i = 1; i < chunk.length; i++) {
    const c = chunk.charCodeAt(i)
    const isModifier = c === 43 || c === 45 || (c >= 48 && c <= 57)
    if (!isModifier) return false
  }
  if (start === 0) return true
  const before = body.slice(0, start).trimEnd()
  return before.endsWith(':') || before === '-' || before.endsWith(' -')
}

function stripComment(text: string): string {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      i = scanQuoted(text, i, c === 34) - 1
      continue
    }
    if (
      c === 35 /* # */ &&
      (i === 0 || text.charCodeAt(i - 1) === 32 || text.charCodeAt(i - 1) === 9)
    ) {
      return text.slice(0, i)
    }
  }
  return text
}

function tokenize(text: string, lineIndex: number, states: LineStates | undefined): Token[] {
  const tokens: Token[] = []
  const state = states?.[lineIndex] ?? 0
  if ((state & IN_BLOCK_SCALAR) !== 0) {
    push(tokens, 'string', 0, text.length)
    return tokens
  }

  let i = indentOf(text)
  if (i >= text.length) return tokens

  if (text.charCodeAt(i) === 35 /* # */) {
    push(tokens, 'comment', i, text.length)
    return tokens
  }

  if (isDocumentMarker(text)) {
    push(tokens, 'punctuation', 0, 3)
    scanValue(text, 3, tokens)
    return tokens
  }

  // Sequence markers can stack: `- - value`.
  while (text.charCodeAt(i) === 45 /* - */ && isSpaceOrEnd(text, i + 1)) {
    push(tokens, 'punctuation', i, i + 1)
    i = skipSpace(text, i + 1)
  }

  if ((state & IN_FLOW) === 0) {
    const colon = findKeyColon(text, i)
    if (colon !== -1) {
      push(tokens, 'key', i, colon)
      push(tokens, 'punctuation', colon, colon + 1)
      i = colon + 1
    }
  }

  scanValue(text, i, tokens)
  return tokens
}

function isSpaceOrEnd(text: string, at: number): boolean {
  if (at >= text.length) return true
  const c = text.charCodeAt(at)
  return c === 32 || c === 9
}

function skipSpace(text: string, from: number): number {
  let i = from
  while (i < text.length && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) i++
  return i
}

/** Index of the `:` that terminates a block mapping key, or -1. */
function findKeyColon(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 34 || c === 39) {
      i = scanQuoted(text, i, c === 34) - 1
      continue
    }
    if (c === 35 && (text.charCodeAt(i - 1) === 32 || text.charCodeAt(i - 1) === 9)) return -1
    if (c === 91 || c === 123) return -1
    if (c === 58 /* : */ && isSpaceOrEnd(text, i + 1)) return i
  }
  return -1
}

function scanValue(text: string, from: number, tokens: Token[]): void {
  let i = skipSpace(text, from)
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
    if (c === 91 || c === 93 || c === 123 || c === 125 || c === 44 || c === 58) {
      push(tokens, 'punctuation', i, i + 1)
      i++
      continue
    }
    // Anchors (&a), aliases (*a), tags (!!str) and block indicators are markup,
    // not data; aliases are never expanded, which rules out YAML bombs.
    if (c === 38 || c === 42 || c === 33 || c === 124 || c === 62 || c === 63) {
      const start = i
      i++
      while (i < text.length && !isBreak(text.charCodeAt(i))) i++
      push(tokens, 'punctuation', start, i)
      continue
    }
    const start = i
    while (i < text.length) {
      const cc = text.charCodeAt(i)
      if (cc === 44 || cc === 93 || cc === 125) break
      if (cc === 35 && (text.charCodeAt(i - 1) === 32 || text.charCodeAt(i - 1) === 9)) break
      i++
    }
    let end = i
    while (end > start && isBreak(text.charCodeAt(end - 1))) end--
    const word = text.slice(start, end)
    push(tokens, isFlowKey(text, end) ? 'key' : classifyScalar(word), start, end)
  }
}

function isBreak(c: number): boolean {
  return c === 32 || c === 9
}

function isFlowKey(text: string, end: number): boolean {
  const next = skipSpace(text, end)
  return text.charCodeAt(next) === 58 && isSpaceOrEnd(text, next + 1)
}

function detect(_source: string, lines: readonly string[]): number {
  let mappings = 0
  let markers = 0
  let other = 0
  const scanned = Math.min(lines.length, 200)
  for (let i = 0; i < scanned; i++) {
    const text = lines[i] ?? ''
    if (isBlank(text)) continue
    const at = indentOf(text)
    if (text.charCodeAt(at) === 35) continue
    if (isDocumentMarker(text)) {
      markers++
      continue
    }
    if (text.charCodeAt(at) === 45 && isSpaceOrEnd(text, at + 1)) {
      mappings++
      continue
    }
    if (findKeyColon(text, at) !== -1) mappings++
    else other++
  }
  if (mappings === 0) return 0
  if (other > mappings) return 0
  return markers > 0 ? 0.8 : 0.55
}

/**
 * YAML. Folding follows indentation, the way editors do it, so a half-written
 * document still folds; block scalars (`|`, `>`) and multi-line flow
 * collections each fold as a single range.
 *
 * Importing this module registers the provider:
 *
 * @example
 * ```ts
 * import '@krona/core/yaml'
 * parseDocument(source, 'yaml')
 * ```
 */
export const yamlProvider: FormatProvider = {
  id: 'yaml',
  displayName: 'YAML',
  extensions: ['.yaml', '.yml'],
  detect,
  analyze,
  tokenize,
}

registerFormat(yamlProvider)
