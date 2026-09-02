/**
 * Labels moved to the core, where every adapter can reach them: the strings are
 * plain data with no DOM or framework in them, and a second renderer would
 * otherwise have to keep its own copy of the same English.
 *
 * Re-exported here so `kronajs` remains one import for the common case.
 */
export type { KronaLabels } from '@kronajs/core'
export { createDefaultLabels, resolveLabels } from '@kronajs/core'
