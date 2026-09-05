import type { ParseLimits, ParseOptions, ResolvedParseOptions } from './types'

/**
 * Defaults chosen so that a hostile or accidental 200 MB file fails fast with a
 * readable diagnostic instead of freezing the tab.
 */
export const DEFAULT_LIMITS: ParseLimits = {
  maxInputLength: 10 * 1024 * 1024,
  maxDepth: 64,
  maxLines: 1_000_000,
  maxFoldRanges: 200_000,
  maxTokenizedLineLength: 10_000,
  maxValidatedLength: 64 * 1024,
}

/**
 * One limit as an integer the checks can rely on.
 *
 * `NaN` compares false with everything and a negative number bounds nothing:
 * either would switch a guard off in silence, which is the one thing a safety
 * limit must never do — a host that ran a setting through `Number()` would lose
 * the protection and never hear about it. `Infinity` is an explicit request for
 * no bound and is honoured as the largest integer there is.
 */
function bound(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value) || value < 0) return fallback
  if (value === Number.POSITIVE_INFINITY) return Number.MAX_SAFE_INTEGER
  return Math.floor(value)
}

/** Applies {@link DEFAULT_LIMITS} to the caller's partial overrides. */
export function resolveOptions(options: ParseOptions | undefined): ResolvedParseOptions {
  const overrides = options?.limits
  if (!overrides) return { limits: DEFAULT_LIMITS }
  return {
    limits: {
      maxInputLength: bound(overrides.maxInputLength, DEFAULT_LIMITS.maxInputLength),
      maxLines: bound(overrides.maxLines, DEFAULT_LIMITS.maxLines),
      maxDepth: bound(overrides.maxDepth, DEFAULT_LIMITS.maxDepth),
      maxFoldRanges: bound(overrides.maxFoldRanges, DEFAULT_LIMITS.maxFoldRanges),
      maxTokenizedLineLength: bound(
        overrides.maxTokenizedLineLength,
        DEFAULT_LIMITS.maxTokenizedLineLength,
      ),
      maxValidatedLength: bound(overrides.maxValidatedLength, DEFAULT_LIMITS.maxValidatedLength),
    },
  }
}
