import {
  type Diagnostic,
  type DocumentModel,
  type Format,
  type KronaLabels,
  parseDocument,
  resolveLabels,
} from '@kronajs/core'
import { el } from './dom'
import { KRONA_CSS } from './theme/css'

/** Colour scheme, matching the React package's `theme`. */
export type KronaElementTheme = 'light' | 'dark' | 'auto'

/** What `krona-fold` carries: the line a block starts on, and its new state. */
export interface KronaFoldDetail {
  readonly line: number
  readonly folded: boolean
}

/**
 * What `krona-select-line` carries: the line the reader picked, counting from
 * 1, and in a diff the version it belongs to.
 */
export interface KronaSelectLineDetail {
  readonly line: number
  readonly side?: 'left' | 'right'
}

/** What `krona-change` carries: the whole document, as it stands after an edit. */
export interface KronaChangeDetail {
  readonly source: string
}

const asNumber = (value: string | null, fallback: number): number => {
  const parsed = Number(value)
  return value === null || value === '' || Number.isNaN(parsed) ? fallback : parsed
}

/**
 * What `<krona-viewer>` and `<krona-diff>` have in common: a shadow root with
 * the stylesheet in it, the attributes that say how to paint rather than what,
 * and a render coalesced to one frame.
 *
 * Not exported from the package. It exists to keep two elements from repeating
 * each other, not to be a base class anyone else builds on.
 */
export abstract class KronaBase extends HTMLElement {
  /** The `.krona` container: theme, fonts, and the row pitch. */
  protected readonly frame: HTMLDivElement
  /** The mode's own region — `.krona-viewer` or `.krona-diff`. */
  protected readonly section: HTMLElement

  #diagnostics: HTMLDivElement
  #labels: Partial<KronaLabels> | null = null
  #resolved: KronaLabels
  #frameHandle = 0
  #narrow = false
  #resize: ResizeObserver | null = null

  protected constructor(mode: 'krona-viewer' | 'krona-diff') {
    super()
    this.#resolved = resolveLabels(undefined, undefined)

    const root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    // The host is not styled by the sheet — it knows nothing of a shadow root —
    // so the two rules it needs are stated here.
    style.textContent = `:host { display: block; min-height: 0 }\n:host([hidden]) { display: none }\n${KRONA_CSS}`
    root.append(style)

    this.#diagnostics = el('div', 'krona-diagnostics')
    this.#diagnostics.setAttribute('role', 'status')
    this.section = el('section', mode, [this.#diagnostics])
    this.frame = el('div', 'krona', [this.section])
    root.append(this.frame)
  }

  /** Overrides for the built-in English strings. */
  get labels(): Partial<KronaLabels> | null {
    return this.#labels
  }

  set labels(value: Partial<KronaLabels> | null) {
    this.#labels = value
    this.schedule()
  }

  connectedCallback(): void {
    this.#watchWidth()
    this.schedule()
  }

  disconnectedCallback(): void {
    this.#resize?.disconnect()
    this.#resize = null
    if (this.#frameHandle) cancelAnimationFrame(this.#frameHandle)
    this.#frameHandle = 0
  }

  /**
   * Whether the element is too narrow for a layout that assumes room.
   *
   * The element's own width, not the window's: a diff can sit in a sidebar on a
   * wide screen and be just as cramped as one on a phone, and a media query
   * cannot tell the difference. The first paint answers `false`, since nothing
   * has been measured yet — a narrow layout appears one frame in, which is the
   * cost of asking the layout rather than guessing at it.
   */
  protected get narrow(): boolean {
    return this.#narrow
  }

  /** Width below which the layout gives up on two columns. `0` turns it off. */
  protected get narrowWidth(): number {
    return Math.max(0, asNumber(this.getAttribute('narrow-width'), 640))
  }

  #watchWidth(): void {
    if (this.#resize || typeof ResizeObserver === 'undefined') return
    this.#resize = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const threshold = this.narrowWidth
      // `borderBoxSize` where it exists; the rect is the fallback and agrees.
      const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
      const narrow = threshold > 0 && width > 0 && width < threshold
      if (narrow === this.#narrow) return
      this.#narrow = narrow
      this.schedule()
    })
    this.#resize.observe(this)
  }

  abstract attributeChangedCallback(
    name: string,
    previous: string | null,
    value: string | null,
  ): void

  protected get currentLabels(): KronaLabels {
    return this.#resolved
  }

  protected get lineHeight(): number {
    return Math.max(1, asNumber(this.getAttribute('line-height'), 20))
  }

  protected get overscan(): number {
    return Math.max(0, asNumber(this.getAttribute('overscan'), 8))
  }

  /** Zero-based, because everything inside is; one-based at the attribute. */
  protected get selectedLine(): number | null {
    const line = asNumber(this.getAttribute('selected-line'), 0)
    return line > 0 ? line - 1 : null
  }

  /** `undefined` collapses nothing, which is a different answer from `0`. */
  protected get collapsedDepth(): number | undefined {
    const depth = this.getAttribute('collapsed-depth')
    return depth === null ? undefined : Math.max(0, asNumber(depth, 0))
  }

  protected parse(source: string, format: Format): DocumentModel {
    return parseDocument(source, format)
  }

  /** Coalesces the several attribute changes one assignment can cause. */
  protected schedule(): void {
    if (!this.isConnected || this.#frameHandle) return
    this.#frameHandle = requestAnimationFrame(() => {
      this.#frameHandle = 0
      this.render()
    })
  }

  /** Theme, row pitch, accessible name and diagnostics — everything but rows. */
  protected paintFrame(diagnostics: readonly Diagnostic[]): void {
    this.#resolved = resolveLabels(
      this.#labels ?? undefined,
      this.getAttribute('locale') ?? undefined,
    )
    this.frame.dataset.theme = (this.getAttribute('theme') ?? 'auto') as KronaElementTheme
    if (this.#narrow) this.frame.dataset.narrow = 'true'
    else delete this.frame.dataset.narrow
    // The virtualizer positions rows at this pitch; CSS has to paint them at the
    // same one, or the two drift apart as the value moves.
    this.frame.style.setProperty('--krona-line-height', `${this.lineHeight}px`)
    this.section.setAttribute('aria-label', this.#resolved.document)

    const show = this.getAttribute('show-diagnostics') !== 'false'
    const shown = show ? diagnostics : []
    this.#diagnostics.replaceChildren(
      ...shown.map((diagnostic) =>
        el('p', `krona-diagnostic krona-diagnostic--${diagnostic.severity}`, diagnostic.message),
      ),
    )
    this.#diagnostics.hidden = shown.length === 0
  }

  protected emitFold(line: number, folded: boolean): void {
    this.dispatchEvent(
      new CustomEvent<KronaFoldDetail>('krona-fold', {
        bubbles: true,
        composed: true,
        detail: { line, folded },
      }),
    )
  }

  protected abstract render(): void
}
