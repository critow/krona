import { textProvider } from '../formats/text'
import { resolveOptions } from './limits'
import { splitLines, toLines } from './lines'
import { defaultRegistry, detectFormat } from './registry'
import type {
  Diagnostic,
  DocumentModel,
  DocumentSnapshot,
  FoldRange,
  Format,
  FormatProvider,
  Line,
  LineStates,
  ParseOptions,
  ResolvedParseOptions,
  Token,
} from './types'

const EMPTY_TOKENS: readonly Token[] = []

interface BuildInput {
  readonly format: string
  readonly source: string
  readonly lines: readonly Line[]
  readonly foldingRanges: readonly FoldRange[]
  readonly diagnostics: readonly Diagnostic[]
  readonly lineStates: LineStates | undefined
  readonly provider: FormatProvider
  readonly options: ResolvedParseOptions
}

class Document implements DocumentModel {
  readonly format: string
  readonly source: string
  readonly lines: readonly Line[]
  readonly foldingRanges: readonly FoldRange[]
  readonly diagnostics: readonly Diagnostic[]

  private readonly provider: FormatProvider
  private readonly lineStates: LineStates | undefined
  private readonly maxTokenizedLineLength: number
  private readonly tokenCache: Array<readonly Token[] | undefined>
  private readonly foldByStart: Map<number, FoldRange>

  constructor(input: BuildInput) {
    this.format = input.format
    this.source = input.source
    this.lines = input.lines
    this.foldingRanges = input.foldingRanges
    this.diagnostics = input.diagnostics
    this.provider = input.provider
    this.lineStates = input.lineStates
    this.maxTokenizedLineLength = input.options.limits.maxTokenizedLineLength
    this.tokenCache = new Array(input.lines.length)
    this.foldByStart = new Map()
    for (const range of input.foldingRanges) {
      if (!this.foldByStart.has(range.startLine)) this.foldByStart.set(range.startLine, range)
    }
  }

  tokensAt(lineIndex: number): readonly Token[] {
    const cached = this.tokenCache[lineIndex]
    if (cached !== undefined) return cached
    const line = this.lines[lineIndex]
    if (line === undefined) return EMPTY_TOKENS
    // Very long lines are the classic way to turn a linear tokenizer into a
    // visible stall; they render unstyled instead.
    let tokens: readonly Token[] = EMPTY_TOKENS
    if (line.text.length <= this.maxTokenizedLineLength) {
      try {
        tokens = this.provider.tokenize(line.text, lineIndex, this.lineStates)
      } catch {
        tokens = EMPTY_TOKENS
      }
    }
    this.tokenCache[lineIndex] = tokens
    return tokens
  }

  foldAt(lineIndex: number): FoldRange | undefined {
    return this.foldByStart.get(lineIndex)
  }
}

function clampRanges(
  ranges: readonly FoldRange[],
  options: ResolvedParseOptions,
  lineCount: number,
  diagnostics: Diagnostic[],
): FoldRange[] {
  const { maxDepth, maxFoldRanges } = options.limits
  const out: FoldRange[] = []
  let droppedDepth = 0
  for (const range of ranges) {
    if (out.length >= maxFoldRanges) {
      diagnostics.push({
        severity: 'warning',
        code: 'too-many-fold-ranges',
        message: `Folding stopped after ${maxFoldRanges} ranges.`,
      })
      break
    }
    if (range.level >= maxDepth) {
      droppedDepth++
      continue
    }
    if (range.endLine <= range.startLine) continue
    if (range.startLine < 0 || range.endLine >= lineCount) continue
    out.push(range)
  }
  if (droppedDepth > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'max-depth-exceeded',
      message: `${droppedDepth} folding ranges deeper than ${maxDepth} levels were dropped.`,
    })
  }
  return out
}

/**
 * Parses `source` into a {@link DocumentModel}.
 *
 * This function never throws for content reasons: a broken file, an unknown
 * format or an oversized input all degrade to plain text with a diagnostic
 * attached, so a viewer can always render something.
 *
 * @param source Raw file contents.
 * @param format Provider id, or `'auto'` to sniff among registered providers.
 *
 * @example
 * ```ts
 * const doc = parseDocument(await file.text(), 'auto')
 * console.log(doc.format, doc.foldingRanges.length)
 * ```
 */
export function parseDocument(
  source: string,
  format: Format = 'auto',
  options?: ParseOptions,
): DocumentModel {
  const resolved = resolveOptions(options)
  const registry = options?.providers ?? defaultRegistry
  const diagnostics: Diagnostic[] = []

  const texts = splitLines(source)
  const lines = toLines(texts)

  if (source.length > resolved.limits.maxInputLength) {
    diagnostics.push({
      severity: 'error',
      code: 'input-too-large',
      message: `Input is ${source.length} characters, over the ${resolved.limits.maxInputLength} limit; folding and highlighting are disabled.`,
    })
    return new Document({
      format: 'text',
      source,
      lines,
      foldingRanges: [],
      diagnostics,
      lineStates: undefined,
      provider: textProvider,
      options: resolved,
    })
  }

  const requestedId = format === 'auto' ? detectFormat(source, texts, registry) : format
  let provider = registry.get(requestedId)
  if (!provider) {
    if (requestedId !== 'text') {
      diagnostics.push({
        severity: 'warning',
        code: 'unknown-format',
        message: `No provider registered for format "${requestedId}"; falling back to plain text.`,
      })
    }
    provider = textProvider
  }

  let foldingRanges: readonly FoldRange[] = []
  let lineStates: LineStates | undefined
  try {
    const analysis = provider.analyze(source, texts, resolved)
    foldingRanges = analysis.foldingRanges
    lineStates = analysis.lineStates
    if (analysis.diagnostics) diagnostics.push(...analysis.diagnostics)
  } catch (error) {
    // Rule: a provider must survive broken input. If one does not, the document
    // still opens — as plain text.
    diagnostics.push({
      severity: 'error',
      code: 'analyze-failed',
      message: `Provider "${provider.id}" failed to analyze the document: ${describe(error)}`,
    })
    provider = textProvider
    foldingRanges = []
    lineStates = undefined
  }

  return new Document({
    format: provider.id,
    source,
    lines,
    foldingRanges: clampRanges(foldingRanges, resolved, lines.length, diagnostics),
    diagnostics,
    lineStates,
    provider,
    options: resolved,
  })
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Projects a model into plain, structured-clone-safe data so a Web Worker can
 * `postMessage` it back to the UI thread.
 */
export function toSnapshot(model: DocumentModel, lineStates?: LineStates): DocumentSnapshot {
  return {
    format: model.format,
    source: model.source,
    lines: model.lines,
    foldingRanges: model.foldingRanges,
    diagnostics: model.diagnostics,
    ...(lineStates ? { lineStates } : {}),
  }
}

/** Rebuilds a live model (with lazy tokenization) from a worker snapshot. */
export function fromSnapshot(snapshot: DocumentSnapshot, options?: ParseOptions): DocumentModel {
  const resolved = resolveOptions(options)
  const registry = options?.providers ?? defaultRegistry
  const provider = registry.get(snapshot.format) ?? textProvider
  return new Document({
    format: snapshot.format,
    source: snapshot.source,
    lines: snapshot.lines,
    foldingRanges: snapshot.foldingRanges,
    diagnostics: snapshot.diagnostics,
    lineStates: snapshot.lineStates,
    provider,
    options: resolved,
  })
}
