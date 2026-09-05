import { KRONA_CSS } from './css'

const STYLE_ID = 'krona-styles'

/** Options for {@link injectStyles}. */
export interface InjectStylesOptions {
  /**
   * `nonce` for the injected `<style>`, for a page whose
   * Content-Security-Policy names one in `style-src`. Without it such a page
   * needs `'unsafe-inline'`, or `kronajs/styles.css` imported through its own
   * CSS pipeline instead.
   */
  readonly nonce?: string
}

/**
 * Injects Krona's stylesheet once per document.
 *
 * The CSS is a constant defined in this package — never document content — and
 * it is applied by setting `textContent` on a `<style>` element, so no HTML is
 * ever parsed from a string.
 *
 * Server-rendered pages should import `kronajs/styles.css` instead (or as well:
 * the injection is a no-op once the id is present).
 */
export function injectStyles(
  target: Document | undefined = globalThis.document,
  options?: InjectStylesOptions,
): void {
  if (!target || target.getElementById(STYLE_ID)) return
  const style = target.createElement('style')
  style.id = STYLE_ID
  if (options?.nonce) style.nonce = options.nonce
  style.textContent = KRONA_CSS
  target.head.append(style)
}
