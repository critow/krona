import { createContext, useContext } from 'react'
import type { KronaSearchState } from '../hooks/useSearch'

export type { KronaSearchState }

export const SearchContext = createContext<KronaSearchState | null>(null)

/**
 * The search box's state — the query, how many matches it has and which one the
 * reader is on — for a search control of your own.
 *
 * Both modes provide it, so a control written once works in a viewer and in a
 * diff. In a diff the matches are ordered by row: walking them reads down the
 * screen rather than through one document and then the other.
 *
 * @example
 * ```tsx
 * function Found() {
 *   const { total, position, next } = useKronaSearch()
 *   return <button onClick={next}>{position}/{total}</button>
 * }
 * ```
 *
 * @throws if called outside `<Krona.Viewer>` or `<Krona.Diff>`.
 */
export function useKronaSearch(): KronaSearchState {
  const state = useContext(SearchContext)
  if (!state) {
    throw new Error('Krona: useKronaSearch() must be called inside <Krona.Viewer> or <Krona.Diff>.')
  }
  return state
}
