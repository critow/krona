import {
  type DocumentModel,
  type Format,
  type FormatRegistry,
  type ParseLimits,
  parseDocument,
} from '@krona/core'
import { useMemo } from 'react'

const EMPTY = ''

/**
 * Resolves the document a mode should render: either the caller's pre-parsed
 * model, or one parsed here and memoized on the inputs that can change it.
 *
 * Accepting a ready model is what makes off-thread parsing practical: a Web
 * Worker can `parseDocument` a large file, `postMessage` the snapshot back, and
 * the UI thread only rehydrates it. Krona cannot instantiate the worker for
 * you — that is bundler-specific — but the model it needs is plain data.
 *
 * @throws if neither a source string nor a model is supplied.
 */
export function useDocument(
  source: string | undefined,
  model: DocumentModel | undefined,
  format: Format,
  limits: Partial<ParseLimits> | undefined,
  providers: FormatRegistry | undefined,
): DocumentModel {
  if (model === undefined && source === undefined) {
    throw new Error('Krona: pass either a `source` string or a parsed `model`.')
  }
  return useMemo(
    () =>
      model ??
      parseDocument(source ?? EMPTY, format, {
        ...(limits ? { limits } : {}),
        ...(providers ? { providers } : {}),
      }),
    [source, model, format, limits, providers],
  )
}
