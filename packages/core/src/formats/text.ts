import type { AnalysisResult, FormatProvider, Token } from '../model/types'

const NO_RANGES: AnalysisResult = { foldingRanges: [] }
const NO_TOKENS: readonly Token[] = []

/**
 * The fallback provider: every line is plain, nothing folds.
 *
 * Krona degrades to this whenever a format provider is missing, a limit is hit,
 * or a provider throws — the viewer always renders something.
 */
export const textProvider: FormatProvider = {
  id: 'text',
  displayName: 'Plain text',
  extensions: ['.txt', '.log'],
  analyze: () => NO_RANGES,
  tokenize: () => NO_TOKENS,
}
