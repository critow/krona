import { KRONA_CSS } from './css'

const STYLE_ID = 'krona-styles'

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
export function injectStyles(target: Document | undefined = globalThis.document): void {
  if (!target || target.getElementById(STYLE_ID)) return
  const style = target.createElement('style')
  style.id = STYLE_ID
  style.textContent = KRONA_CSS
  target.head.append(style)
}
