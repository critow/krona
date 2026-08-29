/**
 * Krona core — framework-agnostic document model, format providers and diff.
 *
 * Importing this entry point registers the JSON, TOML and INI providers.
 * YAML is behind `@kronajs/core/yaml` so the `yaml` parser never lands in a
 * bundle that only shows JSON.
 */

export type { Duplication, EditResult, SourceEdit } from './edit/edit'
export {
  applyEdit,
  blockSpanAt,
  duplicateBlockEdit,
  formattedEdit,
  lineSpanAt,
  minimalEdit,
  offsetOfLine,
  removeBlockEdit,
  valueSpansAt,
} from './edit/edit'
export { iniProvider } from './formats/ini'
export { jsonProvider } from './formats/json'
export { textProvider } from './formats/text'
export { tomlProvider } from './formats/toml'
export { fromSnapshot, parseDocument, toSnapshot } from './model/document'
export { DEFAULT_LIMITS } from './model/limits'
export { OffsetIndex, splitLines } from './model/lines'
export type { PathPart } from './model/path'
export { joinPath, pathSegmentOf } from './model/path'
export {
  defaultRegistry,
  detectFormat,
  getFormat,
  listFormats,
  registerFormat,
  unregisterFormat,
} from './model/registry'
export type {
  AnalysisResult,
  BuiltinFormat,
  Diagnostic,
  DiagnosticSeverity,
  DocumentModel,
  DocumentSnapshot,
  FoldKind,
  FoldRange,
  Format,
  FormatProvider,
  FormatRegistry,
  FormatRequest,
  FormatSpan,
  Line,
  LineStates,
  ParseLimits,
  ParseOptions,
  ResolvedParseOptions,
  TextReplacement,
  Token,
  TokenType,
} from './model/types'
export type { UnsafeKind, UnsafeSpan } from './model/unicode'
export { hasUnsafeCharacters, scanUnsafeCharacters } from './model/unicode'
export type { SearchMatch, SearchOptions, SearchResult } from './search/search'
export { findMatches, matchAfter } from './search/search'

// yamlProvider is intentionally NOT re-exported here: see '@kronajs/core/yaml'.

import { iniProvider } from './formats/ini'
import { jsonProvider } from './formats/json'
import { textProvider } from './formats/text'
import { tomlProvider } from './formats/toml'
import { registerFormat } from './model/registry'

// Each provider module also registers itself, which is what makes
// `import 'krona/yaml'` work. That alone is not enough here: a bundler told the
// package is side-effect-free drops a re-export whose binding nobody reads, and
// the registration goes with it — the document then renders as plain text, with
// no highlighting and nothing to fold. Registering through bindings this module
// actually holds keeps the built-in formats independent of that metadata.
// `text` is listed for symmetry only — `detectFormat` skips it.
registerFormat(iniProvider)
registerFormat(jsonProvider)
registerFormat(textProvider)
registerFormat(tomlProvider)

export type { AlignedDiff, AlignedRow, AlignOptions, DiffStats, RowKind } from './diff/align'
export { alignDiff, nextChangedRow, previousChangedRow, similarityOf } from './diff/align'
export type { CollapsedRegion, CollapseOptions, ExpandDirection } from './diff/collapse'
export { collapseUnchanged, expandRegion, hiddenCount, hiddenRowSet } from './diff/collapse'
export type { IntralineOptions, IntralineResult, Span } from './diff/intraline'
export { intralineDiff, tokenizeWords } from './diff/intraline'
export type { DiffChange, DiffOp, DiffResult, LineDiffOptions } from './diff/myers'
export { diffLineArrays, diffLines } from './diff/myers'
