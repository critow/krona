/**
 * Krona core — framework-agnostic document model, format providers and diff.
 *
 * Importing this entry point registers the JSON, TOML and INI providers.
 * YAML is behind `@krona/core/yaml` so the `yaml` parser never lands in a
 * bundle that only shows JSON.
 */

export { iniProvider } from './formats/ini'
export { jsonProvider } from './formats/json'
export { textProvider } from './formats/text'
export { tomlProvider } from './formats/toml'
export { fromSnapshot, parseDocument, toSnapshot } from './model/document'
export { DEFAULT_LIMITS } from './model/limits'
export { OffsetIndex, splitLines } from './model/lines'
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
  Line,
  LineStates,
  ParseLimits,
  ParseOptions,
  ResolvedParseOptions,
  Token,
  TokenType,
} from './model/types'
export type { UnsafeKind, UnsafeSpan } from './model/unicode'
export { hasUnsafeCharacters, scanUnsafeCharacters } from './model/unicode'

// yamlProvider is intentionally NOT re-exported here: see '@krona/core/yaml'.

import { textProvider } from './formats/text'
import { registerFormat } from './model/registry'

registerFormat(textProvider)
