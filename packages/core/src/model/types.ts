/**
 * Krona's internal representation is deliberately *not* a tree of parsed values.
 *
 * Diffing is line based (Myers over source lines, exactly like git), and folding
 * is range based (like editor code folding). Modelling a document as
 * `lines + folding ranges` lets both features work over the same substrate, and
 * it means Krona never materialises user data as JavaScript objects.
 */

/** Formats Krona ships providers for. Custom providers may use any other id. */
export type BuiltinFormat =
  | 'json'
  | 'json5'
  | 'yaml'
  | 'toml'
  | 'ini'
  | 'xml'
  | 'hcl'
  | 'properties'
  | 'text'

/**
 * A format id. `'auto'` asks Krona to pick among the *registered* providers.
 * Unknown ids degrade to plain text rather than throwing.
 */
export type Format = BuiltinFormat | 'auto' | (string & {})

/** Syntactic class of a token, used purely for styling. */
export type TokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation'
  | 'comment'
  | 'section'

/** A styled span inside a single line. Offsets are UTF-16 code unit indices. */
export interface Token {
  readonly type: TokenType
  /** Inclusive start column. */
  readonly start: number
  /** Exclusive end column. */
  readonly end: number
}

/** One source line. Line separators are not part of `text`. */
export interface Line {
  /** Zero-based line index. */
  readonly index: number
  readonly text: string
}

/** What a folding range wraps, used to pick a placeholder and an icon. */
export type FoldKind = 'object' | 'array' | 'section' | 'block' | 'element' | 'scalar'

/**
 * A collapsible range of lines. `startLine` stays visible when collapsed;
 * `startLine + 1 .. endLine` are hidden.
 */
export interface FoldRange {
  readonly startLine: number
  /** Inclusive index of the last line belonging to the range. */
  readonly endLine: number
  /** Nesting depth, 0 for top level. */
  readonly level: number
  readonly kind: FoldKind
  /**
   * Language-neutral placeholder shown when collapsed, e.g. `{…}` or `[…]`.
   * Human-readable text ("12 lines") is produced by the UI from `childCount`
   * and the caller's `labels`, so the core stays locale free.
   */
  readonly summary?: string
  /** Number of direct children, when the provider can determine it cheaply. */
  readonly childCount?: number
}

/** Severity of a parse diagnostic. */
export type DiagnosticSeverity = 'error' | 'warning'

/** A non-fatal problem found while analysing a document. */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity
  /** Stable machine-readable code, e.g. `input-too-large`. */
  readonly code: string
  readonly message: string
  /** Zero-based line the diagnostic points at, when known. */
  readonly line?: number
}

/** Hard limits that keep pathological input from hanging or crashing the host. */
export interface ParseLimits {
  /** Maximum accepted input size in UTF-16 code units. Default 10 MiB. */
  readonly maxInputLength: number
  /**
   * Maximum number of lines kept.
   *
   * Size alone does not bound the work: a file of ten million newlines fits
   * inside `maxInputLength` and still asks for a record per line, plus the
   * arrays that run beside them. Past this many the rest is dropped and the
   * document opens as plain text with a diagnostic. Default 1_000_000.
   */
  readonly maxLines: number
  /** Folding ranges deeper than this are dropped. Default 64. */
  readonly maxDepth: number
  /** Total folding ranges kept. Default 200_000. */
  readonly maxFoldRanges: number
  /** Lines longer than this are not tokenized (rendered as plain text). Default 10_000. */
  readonly maxTokenizedLineLength: number
  /**
   * Above this input size, providers skip optional validation and report no
   * diagnostics. Folding and highlighting are unaffected.
   *
   * The YAML provider validates by running the `yaml` parser, which costs
   * roughly ten times its own structural scan; bounding it is what keeps a
   * large file from turning parsing into a long task. Default 64 KiB, which
   * still covers essentially every hand-written configuration file.
   */
  readonly maxValidatedLength: number
}

/** Options accepted by {@link parseDocument}. */
export interface ParseOptions {
  /** Partial overrides for the safety limits. */
  readonly limits?: Partial<ParseLimits>
  /**
   * Provider lookup. Defaults to the module-level registry, which is what
   * `import '@kronajs/core/yaml'` populates.
   */
  readonly providers?: FormatRegistry
}

/** Limits after defaults have been applied. */
export interface ResolvedParseOptions {
  readonly limits: ParseLimits
}

/**
 * Per-line analysis state, one byte per line, produced by
 * {@link FormatProvider.analyze} and consumed by {@link FormatProvider.tokenize}.
 *
 * It exists so a line can be tokenized on its own, in O(line length), without
 * rescanning the document — that is what makes lazy, viewport-only
 * tokenization possible.
 */
export type LineStates = Uint8Array

/** Result of a provider's single linear pass over the document. */
export interface AnalysisResult {
  readonly foldingRanges: readonly FoldRange[]
  readonly diagnostics?: readonly Diagnostic[]
  readonly lineStates?: LineStates
  /**
   * The one path segment each line introduces — a key, or `[3]` for an array
   * element — and nothing for lines that introduce none.
   *
   * Segments, not whole paths: a line's full path is its containers' segments
   * followed by its own, and the containers are the folding ranges around it.
   * Storing the assembled path per line would keep a copy of every ancestor on
   * every descendant, which on a deeply nested file costs far more than the
   * document itself.
   */
  readonly pathSegments?: readonly (string | undefined)[]
}

/** Pluggable support for one configuration file format. */
export interface FormatProvider {
  /** Unique id, matched against the `format` prop. */
  readonly id: string
  /** Human-readable name, used in tooling. Not localized by Krona. */
  readonly displayName: string
  /** File extensions (with leading dot) this provider claims. */
  readonly extensions: readonly string[]
  /**
   * Confidence in `0..1` that `source` is in this format, used by
   * `format="auto"`. Only registered providers are ever asked.
   */
  detect?(source: string, lines: readonly string[]): number
  /** Single linear pass computing folding ranges and per-line state. */
  analyze(source: string, lines: readonly string[], options: ResolvedParseOptions): AnalysisResult
  /** Tokenizes one line. Must be linear in the line length. */
  tokenize(text: string, lineIndex: number, states: LineStates | undefined): readonly Token[]
  /**
   * Rewrites a span into the shape the format is normally written in, as a list
   * of further text replacements. Optional: a provider without it leaves edited
   * text exactly as it was typed.
   *
   * Text in, text out. A formatter that round-tripped through a parsed value
   * would build the JavaScript object the rest of Krona is careful never to
   * build, and would quietly drop whatever the format's value model has no room
   * for — comments, in JSON's case.
   */
  format?(source: string, span: FormatSpan, options: FormatRequest): readonly TextReplacement[]
}

/** A span of source offsets handed to {@link FormatProvider.format}. */
export interface FormatSpan {
  readonly start: number
  readonly end: number
}

/** What the caller wants from {@link FormatProvider.format}. */
export interface FormatRequest {
  /**
   * Allow line breaks to be added or removed. False for an edit made in place
   * inside a line, where re-flowing the line would move text the reader was not
   * looking at.
   */
  readonly expand: boolean
}

/** One replacement produced by {@link FormatProvider.format}. */
export interface TextReplacement {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** A lookup of {@link FormatProvider}s by id. */
export interface FormatRegistry {
  get(id: string): FormatProvider | undefined
  list(): readonly FormatProvider[]
}

/**
 * The parsed document: source lines, folding ranges and lazily tokenized lines.
 *
 * @example
 * ```ts
 * const doc = parseDocument('{"a": 1}', 'json')
 * doc.lines.length // 1
 * doc.tokensAt(0)  // [{ type: 'punctuation', ... }, { type: 'key', ... }, ...]
 * ```
 */
export interface DocumentModel {
  /** Id of the provider that actually handled the document (`'text'` on fallback). */
  readonly format: string
  readonly source: string
  readonly lines: readonly Line[]
  readonly foldingRanges: readonly FoldRange[]
  readonly diagnostics: readonly Diagnostic[]
  /**
   * Per-line path segments, when the provider reports them. Read this to build
   * paths yourself; {@link DocumentModel.pathAt} is the usual way.
   */
  readonly pathSegments: readonly (string | undefined)[] | undefined
  /** Tokens for one line. Results are memoized per line index. */
  tokensAt(lineIndex: number): readonly Token[]
  /** Folding range that starts on the given line, if any. */
  foldAt(lineIndex: number): FoldRange | undefined
  /**
   * Dotted path to what the line introduces — `server.tls.ciphers[0]` — or
   * `undefined` where the format has no such notion, or the line introduces
   * nothing, or the provider does not report segments.
   *
   * A line holding several entries answers with the first: a path names a line,
   * and a line is as fine as this gets.
   */
  pathAt(lineIndex: number): string | undefined
}

/**
 * Structured-clone-safe projection of a {@link DocumentModel}, for handing
 * results back from a Web Worker. Rehydrate it with `fromSnapshot`.
 */
export interface DocumentSnapshot {
  readonly format: string
  readonly source: string
  readonly lines: readonly Line[]
  readonly foldingRanges: readonly FoldRange[]
  readonly diagnostics: readonly Diagnostic[]
  readonly lineStates?: LineStates
  readonly pathSegments?: readonly (string | undefined)[]
}
