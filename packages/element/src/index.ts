/**
 * Krona as a custom element.
 *
 * Everything Krona knows about a configuration file lives in `@kronajs/core`,
 * which has no framework in it; this package renders that in plain DOM, so the
 * viewer and the diff can be used from Vue, Svelte, Angular, Astro or an HTML
 * file with a script tag — anywhere `kronajs`, which needs React, cannot go.
 *
 * @example
 * ```js
 * import { defineKrona } from '@kronajs/element'
 * import '@kronajs/element/yaml'
 *
 * defineKrona()
 * document.querySelector('krona-viewer').source = await file.text()
 * ```
 */
export type { KronaLabels } from '@kronajs/core'
// Re-exported so a page needs one import for the common cases.
export { createDefaultLabels, detectFormat, parseDocument, registerFormat } from '@kronajs/core'
export type { KronaElementTheme, KronaFoldDetail } from './base'
export { KronaDiffElement } from './diff'
export { KRONA_CSS } from './theme/css'
export { KronaViewerElement } from './viewer'

import { KronaDiffElement } from './diff'
import { KronaViewerElement } from './viewer'

/**
 * Registers an element under a name, once.
 *
 * Registering a name that is already taken throws, and a page that loaded two
 * copies of this package would do exactly that — so a second call is a no-op
 * rather than an error.
 */
function define(name: string, element: CustomElementConstructor): void {
  if (customElements.get(name)) return
  customElements.define(name, element)
}

/** Registers `<krona-viewer>`. */
export function defineKronaViewer(name = 'krona-viewer'): void {
  define(name, KronaViewerElement)
}

/** Registers `<krona-diff>`. */
export function defineKronaDiff(name = 'krona-diff'): void {
  define(name, KronaDiffElement)
}

/** Registers every Krona element. */
export function defineKrona(): void {
  defineKronaViewer()
  defineKronaDiff()
}
