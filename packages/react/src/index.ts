/**
 * Krona — collapsible viewer and side-by-side diff for JSON, YAML, TOML and
 * INI/.env configuration files.
 *
 * Importing this entry point registers the JSON, TOML and INI providers. YAML
 * lives behind `krona/yaml` so the `yaml` parser never reaches a bundle that
 * only shows JSON.
 */

export type {
  AlignedRow,
  Diagnostic,
  DiffStats,
  DocumentModel,
  FoldRange,
  Format,
  FormatProvider,
  Line,
  ParseLimits,
  Token,
  TokenType,
} from '@krona/core'
// Re-exported so consumers need only one dependency for the common cases.
export {
  alignDiff,
  collapseUnchanged,
  DEFAULT_LIMITS,
  detectFormat,
  diffLines,
  intralineDiff,
  parseDocument,
  registerFormat,
  scanUnsafeCharacters,
} from '@krona/core'
export type { KronaConfig, KronaTheme } from './context/config'
export { useKronaConfig } from './context/config'
export type { LineSide, LineSource, RenderRow, RowTone } from './context/lineSource'
export { useLineSource } from './context/lineSource'
export type { KronaSlot } from './context/slots'
export type { KronaDiffState } from './diff/DiffContext'
export { useKronaDiff } from './diff/DiffContext'
export type { FoldState } from './hooks/useFoldState'
export { Krona } from './Krona'
export type { KronaRootProps } from './KronaRoot'
export type { KronaLabels } from './labels'
export { createDefaultLabels } from './labels'
export type { KronaDiagnosticsProps } from './parts/Diagnostics'
export { Diagnostics } from './parts/Diagnostics'
export type { KronaGutterProps } from './parts/Gutter'
export { Gutter } from './parts/Gutter'
export type { KronaLinesProps } from './parts/Lines'
export { Lines } from './parts/Lines'
export type { KronaToolbarProps } from './parts/Toolbar'
export { Toolbar } from './parts/Toolbar'
export { KRONA_CSS } from './theme/css'
export { injectStyles } from './theme/injectStyles'
export type { KronaViewerProps } from './viewer/Viewer'
export { KronaViewer } from './viewer/Viewer'
export type { KronaViewerState } from './viewer/ViewerContext'
export { useKronaViewer } from './viewer/ViewerContext'
