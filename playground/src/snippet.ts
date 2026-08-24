import type { CodeToken } from './ui/kit'

export interface SnippetInput {
  format: string
  theme: 'light' | 'dark'
  mode: 'viewer' | 'diff'
  collapseUnchanged: boolean
  showMinimap: boolean
  collapsedDepth: number | undefined
  yaml: boolean
}

const tag = (text: string): CodeToken => ({ text, kind: 'tag' })
const attr = (text: string): CodeToken => ({ text, kind: 'attr' })
const str = (text: string): CodeToken => ({ text, kind: 'str' })
const punct = (text: string): CodeToken => ({ text, kind: 'punct' })
const plain = (text: string): CodeToken => ({ text })

/**
 * Builds the snippet that reproduces exactly what the page is showing.
 *
 * Tokens rather than a string, so the code block never has to parse anything:
 * the demo holds itself to the same rule as the library it demonstrates.
 */
export function buildSnippet(input: SnippetInput): CodeToken[] {
  const out: CodeToken[] = []
  const line = (...tokens: CodeToken[]) => {
    out.push(...tokens, plain('\n'))
  }

  line(punct('import'), plain(' { Krona } '), punct('from'), plain(' '), str("'krona'"))
  if (input.yaml) {
    line(punct('import'), plain(' '), str("'krona/yaml'"))
  }
  line()

  line(
    punct('<'),
    tag('Krona'),
    plain(' '),
    attr('format'),
    punct('='),
    str(`"${input.format}"`),
    plain(' '),
    attr('theme'),
    punct('='),
    str(`"${input.theme}"`),
    punct('>'),
  )

  if (input.mode === 'viewer') {
    const depth =
      input.collapsedDepth === undefined
        ? []
        : [
            plain(' '),
            attr('defaultCollapsedDepth'),
            punct('={'),
            plain(String(input.collapsedDepth)),
            punct('}'),
          ]
    line(
      plain('  '),
      punct('<'),
      tag('Krona.Viewer'),
      plain(' '),
      attr('source'),
      punct('={'),
      plain('text'),
      punct('}'),
      ...depth,
      plain(' '),
      punct('/>'),
    )
  } else {
    line(
      plain('  '),
      punct('<'),
      tag('Krona.Diff'),
      plain(' '),
      attr('left'),
      punct('={'),
      plain('before'),
      punct('}'),
      plain(' '),
      attr('right'),
      punct('={'),
      plain('after'),
      punct('}'),
    )
    if (input.collapseUnchanged) line(plain('    '), attr('collapseUnchanged'))
    if (input.showMinimap) line(plain('    '), attr('showMinimap'))
    line(plain('  '), punct('/>'))
  }

  line(punct('</'), tag('Krona'), punct('>'))
  return out
}
