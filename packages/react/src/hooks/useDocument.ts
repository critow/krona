import { type Format, type FormatRegistry, type ParseLimits, parseDocument } from '@krona/core'
import { useMemo } from 'react'

/**
 * Parses a document, memoized on the inputs that can change its result.
 *
 * Parsing is synchronous by design: it is linear in the file size, and moving
 * it off the main thread is the consumer's call (see the Web Worker recipe in
 * the README) rather than something the component decides.
 */
export function useDocument(
  source: string,
  format: Format,
  limits: Partial<ParseLimits> | undefined,
  providers: FormatRegistry | undefined,
) {
  return useMemo(
    () =>
      parseDocument(source, format, {
        ...(limits ? { limits } : {}),
        ...(providers ? { providers } : {}),
      }),
    [source, format, limits, providers],
  )
}
