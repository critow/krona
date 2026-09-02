/**
 * Krona as a custom element.
 *
 * Everything Krona knows about a configuration file lives in `@kronajs/core`,
 * which has no framework in it; this package renders that in plain DOM, so the
 * viewer can be used from Vue, Svelte, Angular, Astro or an HTML file with a
 * script tag — anywhere `kronajs`, which needs React, cannot go.
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
export { KRONA_CSS } from './theme/css'
export type { KronaElementTheme, KronaFoldDetail } from './viewer'
export { defineKronaViewer, KronaViewerElement } from './viewer'

import { defineKronaViewer } from './viewer'

/** Registers every Krona element. Today that is `<krona-viewer>`. */
export function defineKrona(): void {
  defineKronaViewer()
}
