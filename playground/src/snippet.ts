import type { CodeToken } from './ui/kit'

export interface SnippetInput {
  format: string
  theme: string
  locale: string
  mode: 'viewer' | 'diff'
  yaml: boolean
  lineHeight: number
  collapsedDepth: number | undefined
  overscan: number
  showDiagnostics: boolean
  collapseUnchanged: boolean
  context: number
  minimumHidden: number
  step: number
  showMinimap: boolean
  ignoreTrailingWhitespace: boolean
  view: 'auto' | 'split' | 'unified'
}

const tag = (text: string): CodeToken => ({ text, kind: 'tag' })
const attr = (text: string): CodeToken => ({ text, kind: 'attr' })
const str = (text: string): CodeToken => ({ text, kind: 'str' })
const punct = (text: string): CodeToken => ({ text, kind: 'punct' })
const plain = (text: string): CodeToken => ({ text })

const DEFAULTS = { lineHeight: 20, overscan: 8, context: 3, minimumHidden: 10, step: 20 }

/**
 * Builds the snippet that reproduces exactly what the page is showing.
 *
 * Only props that differ from their defaults are printed: the point is to show
 * the shortest code that produces this view, not to dump every knob. Tokens
 * rather than a string, so the code block never has to parse anything — the
 * demo holds itself to the same rule as the library it demonstrates.
 */
export function buildSnippet(input: SnippetInput): CodeToken[] {
  const out: CodeToken[] = []
  const line = (...tokens: CodeToken[]) => {
    out.push(...tokens, plain('\n'))
  }
  const stringProp = (name: string, value: string) => [
    plain(' '),
    attr(name),
    punct('='),
    str(`"${value}"`),
  ]
  const numberProp = (name: string, value: number) => [
    plain(' '),
    attr(name),
    punct('={'),
    plain(String(value)),
    punct('}'),
  ]

  line(punct('import'), plain(' { Krona } '), punct('from'), plain(' '), str("'krona'"))
  if (input.yaml) line(punct('import'), plain(' '), str("'krona/yaml'"))
  line()

  const rootProps: CodeToken[] = [
    ...stringProp('format', input.format),
    ...stringProp('theme', input.theme),
  ]
  if (input.locale !== 'en') rootProps.push(...stringProp('locale', input.locale))
  if (input.lineHeight !== DEFAULTS.lineHeight) {
    rootProps.push(...numberProp('lineHeight', input.lineHeight))
  }
  line(punct('<'), tag('Krona'), ...rootProps, punct('>'))

  if (input.mode === 'viewer') {
    const props: CodeToken[] = [plain(' '), attr('source'), punct('={'), plain('text'), punct('}')]
    if (input.collapsedDepth !== undefined) {
      props.push(...numberProp('defaultCollapsedDepth', input.collapsedDepth))
    }
    if (input.overscan !== DEFAULTS.overscan) props.push(...numberProp('overscan', input.overscan))
    if (!input.showDiagnostics) {
      props.push(plain(' '), attr('showDiagnostics'), punct('={'), plain('false'), punct('}'))
    }
    line(plain('  '), punct('<'), tag('Krona.Viewer'), ...props, plain(' '), punct('/>'))
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
    if (input.collapsedDepth !== undefined) {
      line(plain('    '), ...numberProp('defaultCollapsedDepth', input.collapsedDepth).slice(1))
    }
    if (input.collapseUnchanged) {
      const tuned =
        input.context !== DEFAULTS.context ||
        input.minimumHidden !== DEFAULTS.minimumHidden ||
        input.step !== DEFAULTS.step
      if (!tuned) {
        line(plain('    '), attr('collapseUnchanged'))
      } else {
        line(
          plain('    '),
          attr('collapseUnchanged'),
          punct('={{'),
          plain(
            ` context: ${input.context}, minimumHidden: ${input.minimumHidden}, step: ${input.step} `,
          ),
          punct('}}'),
        )
      }
    }
    // `auto` is the default, so writing it would be noise in a snippet meant
    // to be the shortest code that produces this view.
    if (input.view !== 'auto') line(plain('    '), ...stringProp('view', input.view).slice(1))
    if (input.showMinimap) line(plain('    '), attr('showMinimap'))
    if (input.ignoreTrailingWhitespace) line(plain('    '), attr('ignoreTrailingWhitespace'))
    if (input.overscan !== DEFAULTS.overscan) {
      line(plain('    '), ...numberProp('overscan', input.overscan).slice(1))
    }
    line(plain('  '), punct('/>'))
  }

  line(punct('</'), tag('Krona'), punct('>'))
  return out
}
