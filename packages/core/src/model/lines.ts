import type { DocumentModel, Line } from './types'

/**
 * Splits source into lines, accepting LF, CRLF and CR terminators.
 *
 * A trailing newline does not produce a phantom empty line, which keeps line
 * counts equal to what editors and `wc -l + 1` report.
 *
 * With `limit`, the scan stops once that many lines exist: a caller about to
 * drop the rest has no reason to pay for splitting it, and a file that is ten
 * million newlines is exactly the caller that would.
 */
export function splitLines(source: string, limit = Number.POSITIVE_INFINITY): string[] {
  if (source === '') return ['']
  if (limit < 1) return []
  const out: string[] = []
  let start = 0
  for (let i = 0; i < source.length && out.length < limit; i++) {
    const ch = source.charCodeAt(i)
    if (ch === 10 /* \n */) {
      out.push(source.slice(start, i))
      start = i + 1
    } else if (ch === 13 /* \r */) {
      out.push(source.slice(start, i))
      if (source.charCodeAt(i + 1) === 10) i++
      start = i + 1
    }
  }
  if (out.length < limit && (start <= source.length - 1 || start === 0)) {
    out.push(source.slice(start))
  }
  return out
}

/** Wraps raw strings into {@link Line} records. */
export function toLines(texts: readonly string[]): Line[] {
  const out: Line[] = new Array(texts.length)
  for (let i = 0; i < texts.length; i++) out[i] = { index: i, text: texts[i] ?? '' }
  return out
}

/**
 * Maps character offsets to zero-based line numbers with a binary search over
 * line starts scanned from the original source — used by providers that work
 * from a parser's offsets (JSON) rather than from split lines.
 */
export class OffsetIndex {
  private readonly starts: number[]

  constructor(source: string) {
    const starts: number[] = [0]
    for (let i = 0; i < source.length; i++) {
      const ch = source.charCodeAt(i)
      if (ch === 10) {
        starts.push(i + 1)
      } else if (ch === 13) {
        if (source.charCodeAt(i + 1) === 10) i++
        starts.push(i + 1)
      }
    }
    this.starts = starts
  }

  /** Offset where a line begins, clamped to the document's last line. */
  startOf(lineIndex: number): number {
    const starts = this.starts
    const clamped = lineIndex < 0 ? 0 : Math.min(lineIndex, starts.length - 1)
    return starts[clamped] ?? 0
  }

  /** Zero-based line containing `offset`, clamped to the document. */
  lineAt(offset: number): number {
    const starts = this.starts
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((starts[mid] ?? 0) <= offset) lo = mid
      else hi = mid - 1
    }
    return lo
  }
}

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
