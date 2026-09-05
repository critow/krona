import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, resolveOptions } from './limits'

describe('resolveOptions', () => {
  it('falls back to the default for a limit that is not a usable number', () => {
    // Switching a guard off in silence is the one thing a limit must not do.
    const limits = resolveOptions({
      limits: { maxInputLength: Number.NaN, maxDepth: -5 },
    }).limits
    expect(limits.maxInputLength).toBe(DEFAULT_LIMITS.maxInputLength)
    expect(limits.maxDepth).toBe(DEFAULT_LIMITS.maxDepth)
  })

  it('reads Infinity as no bound at all, and truncates a fraction', () => {
    const limits = resolveOptions({
      limits: { maxInputLength: Number.POSITIVE_INFINITY, maxDepth: 3.9 },
    }).limits
    expect(limits.maxInputLength).toBe(Number.MAX_SAFE_INTEGER)
    expect(limits.maxDepth).toBe(3)
  })

  it('keeps a limit the caller means', () => {
    expect(resolveOptions({ limits: { maxDepth: 8 } }).limits.maxDepth).toBe(8)
  })
})
