import { type CSSProperties, useContext, useEffect, useRef } from 'react'
import { SearchContext } from '../context/search'
import type { KronaLabels } from '../labels'

/** Props of `<Krona.Search>`. */
export interface KronaSearchProps {
  /** Offer the case-sensitivity toggle. Default true. */
  showMatchCase?: boolean
  /** Focus the field as soon as it appears. Default false. */
  autoFocus?: boolean
  className?: string
  style?: CSSProperties
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="krona-search-arrow">
      <path
        d={up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function countOf(
  labels: KronaLabels,
  query: string,
  total: number,
  position: number,
  truncated: boolean,
): string {
  if (query.length === 0) return ''
  if (total === 0) return labels.noMatches
  return labels.matchCount(position, total, truncated)
}

function SearchBase({
  showMatchCase = true,
  autoFocus = false,
  className,
  style,
}: KronaSearchProps) {
  const search = useContext(SearchContext)
  const field = useRef<HTMLInputElement | null>(null)

  // Focused by hand rather than with the attribute: `autofocus` steals focus
  // whenever the element appears, including on a page the reader was already
  // reading. An effect that runs once does what the prop promises and no more.
  useEffect(() => {
    if (autoFocus) field.current?.focus()
  }, [autoFocus])

  if (!search) return null

  const { caseSensitive, position, query, total, truncated } = search
  const labels = search.labels
  const count = countOf(labels, query, total, position, truncated)

  return (
    <search className={className ? `krona-search ${className}` : 'krona-search'} style={style}>
      <input
        ref={field}
        type="search"
        className="krona-search-input"
        value={query}
        placeholder={labels.search}
        aria-label={labels.search}
        onChange={(event) => search.setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          // Enter walks the matches, the way every search field in an editor
          // does; Shift walks them backwards.
          event.preventDefault()
          if (event.shiftKey) search.previous()
          else search.next()
        }}
      />
      {/* Announced rather than only shown: a reader who cannot see the count
          still needs to know a query found nothing. */}
      <span className="krona-search-count" role="status" aria-live="polite">
        {count}
      </span>
      {showMatchCase ? (
        <button
          type="button"
          className={
            caseSensitive ? 'krona-search-toggle krona-search-toggle--on' : 'krona-search-toggle'
          }
          aria-pressed={caseSensitive}
          aria-label={labels.matchCase}
          data-tip={labels.matchCase}
          onClick={() => search.setCaseSensitive(!caseSensitive)}
        >
          Aa
        </button>
      ) : null}
      <button
        type="button"
        className="krona-search-step"
        aria-label={labels.previousMatch}
        data-tip={labels.previousMatch}
        disabled={total === 0}
        onClick={search.previous}
      >
        <Arrow up />
      </button>
      <button
        type="button"
        className="krona-search-step"
        aria-label={labels.nextMatch}
        data-tip={labels.nextMatch}
        disabled={total === 0}
        onClick={search.next}
      >
        <Arrow up={false} />
      </button>
    </search>
  )
}

/**
 * `Krona.Search` — a field that finds text in what is on screen.
 *
 * Matching is literal, never a pattern: a regular expression typed into a text
 * field is one a stranger can type too, and a viewer that stops answering is
 * worse than one that finds less. Enter and Shift+Enter walk the matches.
 *
 * In a diff it searches both versions and orders the matches by row, so walking
 * them reads down the screen. Jumping opens whatever hides the match — a folded
 * block, a collapsed run of unchanged lines — and scrolls it into view.
 *
 * Renders nothing outside a mode, so it can sit in a layout that serves both.
 */
export const Search = Object.assign(SearchBase, { kronaSlot: 'chrome' as const })
