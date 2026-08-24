import type { ParseLimits, ParseOptions, ResolvedParseOptions } from './types'

/**
 * Defaults chosen so that a hostile or accidental 200 MB file fails fast with a
 * readable diagnostic instead of freezing the tab.
 */
export const DEFAULT_LIMITS: ParseLimits = {
  maxInputLength: 10 * 1024 * 1024,
  maxDepth: 64,
  maxFoldRanges: 200_000,
  maxTokenizedLineLength: 10_000,
  maxValidatedLength: 64 * 1024,
}

/** Applies {@link DEFAULT_LIMITS} to the caller's partial overrides. */
export function resolveOptions(options: ParseOptions | undefined): ResolvedParseOptions {
  const overrides = options?.limits
  if (!overrides) return { limits: DEFAULT_LIMITS }
  return {
    limits: {
      maxInputLength: overrides.maxInputLength ?? DEFAULT_LIMITS.maxInputLength,
      maxDepth: overrides.maxDepth ?? DEFAULT_LIMITS.maxDepth,
      maxFoldRanges: overrides.maxFoldRanges ?? DEFAULT_LIMITS.maxFoldRanges,
      maxTokenizedLineLength:
        overrides.maxTokenizedLineLength ?? DEFAULT_LIMITS.maxTokenizedLineLength,
      maxValidatedLength: overrides.maxValidatedLength ?? DEFAULT_LIMITS.maxValidatedLength,
    },
  }
}
