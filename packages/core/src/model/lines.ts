import type { Line } from './types'

/**
 * Splits source into lines, accepting LF, CRLF and CR terminators.
 *
 * A trailing newline does not produce a phantom empty line, which keeps line
 * counts equal to what editors and `wc -l + 1` report.
 */
export function splitLines(source: string): string[] {
  if (source === '') return ['']
  const out: string[] = []
  let start = 0
  for (let i = 0; i < source.length; i++) {
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
  if (start <= source.length - 1 || start === 0) out.push(source.slice(start))
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
