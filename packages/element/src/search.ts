import type {
  AlignedRow,
  DocumentModel,
  KronaLabels,
  MatchIndex,
  SearchHit,
  Span,
} from '@kronajs/core'
import { findMatches, hitFrom, hitsInRowOrder, indexByLine } from '@kronajs/core'
import { el } from './dom'

/** What to search: one document, or the two of a diff read in row order. */
export type SearchTarget =
  | { readonly kind: 'single'; readonly model: DocumentModel }
  | {
      readonly kind: 'diff'
      readonly left: DocumentModel
      readonly right: DocumentModel
      readonly rows: readonly AlignedRow[]
    }

/** What the box asks of the element that owns it. */
export interface SearchHost {
  readonly labels: () => KronaLabels
  readonly target: () => SearchTarget
  /** Open whatever hides the hit and scroll to it. */
  readonly reveal: (hit: SearchHit) => void
  /** Repaint: the highlights moved. */
  readonly repaint: () => void
}

const NO_SPANS: readonly Span[] = []

const SVG = 'http://www.w3.org/2000/svg'

/** The step arrow, drawn rather than written, so it needs no icon set. */
function arrow(up: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', 'krona-search-arrow')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

/**
 * A field that finds text in what is on screen.
 *
 * Matching is literal, never a pattern: a regular expression typed into a text
 * field is one a stranger can type too, and a viewer that stops answering is a
 * worse outcome than one that cannot match `\\d+`.
 *
 * In a diff the hits are ordered by row rather than by document, so walking
 * them reads down the screen: a line removed and the line that replaced it are
 * neighbours, however far apart they sit in their own files.
 */
export class SearchBox {
  readonly root: HTMLElement

  #host: SearchHost
  #input: HTMLInputElement
  #count: HTMLElement
  #toggle: HTMLButtonElement
  #previous: HTMLButtonElement
  #next: HTMLButtonElement

  #query = ''
  #caseSensitive = false
  #hits: SearchHit[] = []
  #truncated = false
  #index = -1
  /** Where the reader is, so next and previous mean something before a jump. */
  #at = { lineIndex: -1, column: -1 }
  #left: MatchIndex = new Map()
  #right: MatchIndex = new Map()
  #single: MatchIndex = new Map()

  constructor(host: SearchHost) {
    this.#host = host

    this.#input = document.createElement('input')
    this.#input.type = 'search'
    this.#input.className = 'krona-search-input'
    this.#input.addEventListener('input', () => {
      this.#query = this.#input.value
      this.refresh()
    })
    this.#input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      // Enter walks the matches, the way every search field in an editor does;
      // Shift walks them backwards.
      event.preventDefault()
      this.#go(event.shiftKey ? -1 : 1)
    })

    // Announced rather than only shown: a reader who cannot see the count still
    // needs to know a query found nothing.
    this.#count = el('span', 'krona-search-count')
    this.#count.setAttribute('role', 'status')
    this.#count.setAttribute('aria-live', 'polite')

    this.#toggle = el('button', 'krona-search-toggle', 'Aa')
    this.#toggle.type = 'button'
    this.#toggle.addEventListener('click', () => {
      this.#caseSensitive = !this.#caseSensitive
      this.refresh()
    })

    this.#previous = el('button', 'krona-search-step', [arrow(true)])
    this.#previous.type = 'button'
    this.#previous.addEventListener('click', () => this.#go(-1))

    this.#next = el('button', 'krona-search-step', [arrow(false)])
    this.#next.type = 'button'
    this.#next.addEventListener('click', () => this.#go(1))

    this.root = el('search', 'krona-search', [
      this.#input,
      this.#count,
      this.#toggle,
      this.#previous,
      this.#next,
    ])
  }

  /** The match the reader is standing on, wherever it is. */
  get current(): SearchHit | null {
    return this.#index === -1 ? null : (this.#hits[this.#index] ?? null)
  }

  /** Columns to highlight on one line of one version. */
  matchesAt(lineIndex: number, side?: 'left' | 'right'): readonly Span[] {
    if (this.#query.length === 0) return NO_SPANS
    const byLine = side === 'left' ? this.#left : side === 'right' ? this.#right : this.#single
    return byLine.get(lineIndex) ?? NO_SPANS
  }

  /**
   * Runs the query again and repaints. Called when the query changes and when
   * the document does: matches found in a file that has since been replaced
   * would point at lines that are no longer there.
   */
  refresh(): void {
    const target = this.#host.target()
    const options = { caseSensitive: this.#caseSensitive }
    const previous = this.#hits

    if (target.kind === 'single') {
      const result = findMatches(target.model, this.#query, options)
      this.#single = indexByLine(result.matches)
      this.#left = new Map()
      this.#right = new Map()
      this.#hits = result.matches.map((match) => ({ ...match, side: 'single' as const }))
      this.#truncated = result.truncated
    } else {
      const left = findMatches(target.left, this.#query, options)
      const right = findMatches(target.right, this.#query, options)
      this.#left = indexByLine(left.matches)
      this.#right = indexByLine(right.matches)
      this.#single = new Map()
      this.#hits = hitsInRowOrder(target.rows, this.#left, this.#right)
      this.#truncated = left.truncated || right.truncated
    }

    // A new query invalidates the position: the reader is looking for something
    // else now, and the next jump should start from where they are on screen.
    if (!sameHits(previous, this.#hits)) this.#index = -1

    this.#paint()
    this.#host.repaint()
  }

  #go(direction: 1 | -1): void {
    if (this.#hits.length === 0) return
    this.#index =
      this.#index === -1
        ? hitFrom(this.#hits, this.#at, direction)
        : (this.#index + direction + this.#hits.length) % this.#hits.length
    const hit = this.#hits[this.#index]
    if (!hit) return
    this.#at = { lineIndex: hit.lineIndex, column: hit.start }
    this.#paint()
    this.#host.reveal(hit)
    this.#host.repaint()
  }

  #paint(): void {
    const labels = this.#host.labels()
    this.#input.placeholder = labels.search
    this.#input.setAttribute('aria-label', labels.search)
    if (this.#input.value !== this.#query) this.#input.value = this.#query

    this.#count.textContent =
      this.#query.length === 0
        ? ''
        : this.#hits.length === 0
          ? labels.noMatches
          : labels.matchCount(
              this.#index === -1 ? 0 : this.#index + 1,
              this.#hits.length,
              this.#truncated,
            )

    this.#toggle.className = this.#caseSensitive
      ? 'krona-search-toggle krona-search-toggle--on'
      : 'krona-search-toggle'
    this.#toggle.setAttribute('aria-pressed', String(this.#caseSensitive))
    this.#toggle.setAttribute('aria-label', labels.matchCase)
    this.#toggle.dataset.tip = labels.matchCase

    for (const [button, name] of [
      [this.#previous, labels.previousMatch],
      [this.#next, labels.nextMatch],
    ] as const) {
      button.disabled = this.#hits.length === 0
      button.setAttribute('aria-label', name)
      button.dataset.tip = name
    }
  }
}

/**
 * Whether two hit lists describe the same matches.
 *
 * Compared rather than held by identity: the lists are rebuilt on every refresh,
 * so identity would say "different" every time and throw away the reader's
 * position on a repaint that found exactly the same thing.
 */
function sameHits(a: readonly SearchHit[], b: readonly SearchHit[]): boolean {
  if (a.length !== b.length) return false
  return a.every((hit, i) => {
    const other = b[i]
    return (
      other !== undefined &&
      hit.lineIndex === other.lineIndex &&
      hit.start === other.start &&
      hit.side === other.side
    )
  })
}
