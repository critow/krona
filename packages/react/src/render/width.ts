import type { DocumentModel } from '@kronajs/core'

/**
 * The widest line, in characters, across the given documents.
 *
 * Rows are virtualized, and an absolutely positioned row contributes nothing to
 * its column's intrinsic width, so without a reserved width the horizontal
 * scroll extent is whatever the rows currently on screen happen to need — it
 * grows and shrinks as you scroll vertically. Reserving the whole document's
 * width instead keeps that extent still, and gives both panels of a diff the
 * same one, which is what makes horizontal scroll sync land on the same column
 * on both sides.
 *
 * The count is in characters because the component requires a monospace face,
 * where `ch` is exact. A line of wider glyphs still overflows past it, and the
 * reserved width is a minimum rather than a cap.
 */
export function contentColumnsOf(...models: readonly (DocumentModel | undefined)[]): number {
  let widest = 0
  for (const model of models) {
    if (!model) continue
    for (const line of model.lines) {
      if (line.text.length > widest) widest = line.text.length
    }
  }
  return widest
}
