import { Krona, useKronaDiff } from 'krona'
import 'krona/yaml'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DICTS, type Lang } from './i18n'
import { SAMPLES } from './samples'
import { buildSnippet } from './snippet'
import { Badge, Checkbox, CodeBlock, Field, NumberField, Panel, Segmented, Select } from './ui/kit'

type Mode = 'viewer' | 'diff'
type Theme = 'light' | 'dark' | 'auto'

/**
 * Page state lives in the query string, so the visual-regression suite can
 * navigate straight to a reference view and a link carries what the sender was
 * looking at.
 */
function readParams() {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  const sample = params.get('sample')
  const theme = params.get('theme')
  return {
    mode: params.get('mode') === 'viewer' ? ('viewer' as Mode) : ('diff' as Mode),
    sampleId: SAMPLES.some((s) => s.id === sample) ? (sample as string) : (SAMPLES[0]?.id ?? ''),
    theme: theme === 'light' || theme === 'auto' ? (theme as Theme) : ('dark' as Theme),
    lang: params.get('lang') === 'ru' ? ('ru' as Lang) : ('en' as Lang),
    collapse: params.get('collapse') !== 'off',
    minimap: params.get('minimap') !== 'off',
    view: (['auto', 'split', 'unified'] as const).includes(
      params.get('view') as 'auto' | 'split' | 'unified',
    )
      ? (params.get('view') as 'auto' | 'split' | 'unified')
      : ('auto' as const),
  }
}

/**
 * The diff's panels, laid out for the width there is.
 *
 * A custom layout is the consumer's to arrange, so Krona leaves it alone however
 * narrow the root gets; `useKronaDiff().narrow` is how a layout of your own asks
 * whether it has room for two panels.
 */
function DiffPanelsBase({
  showMarkers,
  showMinimap,
}: {
  showMarkers: boolean
  showMinimap: boolean
}) {
  const { narrow, side, unified } = useKronaDiff()
  const panel = (which: 'left' | 'right') => (
    <Krona.Panel side={which}>
      <Krona.Gutter showMarkers={showMarkers} />
      <Krona.Lines />
    </Krona.Panel>
  )
  // `view` decides for the default layout; a custom one asks `unified` and
  // arranges itself, which is the whole point of laying it out by hand.
  if (unified) {
    return (
      <Krona.Unified>
        <Krona.Gutter showMarkers={showMarkers} />
        <Krona.Lines />
      </Krona.Unified>
    )
  }
  if (narrow) return panel(side)
  return (
    <>
      {panel('left')}
      {showMinimap ? <Krona.Minimap /> : null}
      {panel('right')}
    </>
  )
}

// Krona places a custom layout by the `kronaSlot` each component declares. A
// component of your own that stands in for panels has to say so, or it is taken
// for chrome and lands above the panel row rather than inside it — with no
// height, since that region is sized by its content.
const DiffPanels = Object.assign(DiffPanelsBase, { kronaSlot: 'panels' as const })

export function App() {
  const initial = useMemo(readParams, [])
  const [lang, setLang] = useState<Lang>(initial.lang)
  const [mode, setMode] = useState<Mode>(initial.mode)
  const [sampleId, setSampleId] = useState(initial.sampleId)
  const [theme, setTheme] = useState<Theme>(initial.theme)

  const [collapseUnchanged, setCollapseUnchanged] = useState(initial.collapse)
  const [showMinimap, setShowMinimap] = useState(initial.minimap)
  const [view, setView] = useState(initial.view)
  const [showDiagnostics, setShowDiagnostics] = useState(true)
  const [editable, setEditable] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)
  const [ignoreTrailingWhitespace, setIgnoreTrailingWhitespace] = useState(false)
  // The demo lands partially collapsed on purpose: with everything expanded
  // there is nothing to notice, and the fold controls read as decoration.
  const [collapsedDepth, setCollapsedDepth] = useState<number | undefined>(2)
  const [lineHeight, setLineHeight] = useState(20)
  const [overscan, setOverscan] = useState(8)
  const [context, setContext] = useState(3)
  const [minimumHidden, setMinimumHidden] = useState(10)
  const [step, setStep] = useState(20)

  const dict = DICTS[lang]
  const sample = useMemo(() => SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!, [sampleId])
  const note = dict.notes[sample.id] ?? sample.note

  // `auto` follows the reader's system setting for the component only; the page
  // around it stays dark, so that is the chrome the mark has to sit on.
  const uiTheme = theme === 'auto' ? 'dark' : theme

  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme
  }, [uiTheme])

  // The tab is part of the page: it names the same thing in the same language,
  // and `lang` has to agree with what is actually on screen for a screen reader
  // to read it in the right voice.
  useEffect(() => {
    document.title = `Krona — ${dict.tagline}`
    document.documentElement.lang = lang
  }, [dict.tagline, lang])

  const syncUrl = useCallback((next: Record<string, string>) => {
    const params = new URLSearchParams(globalThis.location.search)
    for (const [key, value] of Object.entries(next)) params.set(key, value)
    history.replaceState(null, '', `?${params.toString()}`)
  }, [])

  const collapseOptions = useMemo(
    () => ({ context, minimumHidden, step }),
    [context, minimumHidden, step],
  )

  const snippet = useMemo(
    () =>
      buildSnippet({
        format: sample.format,
        theme,
        locale: lang,
        mode,
        yaml: sample.format === 'yaml',
        lineHeight,
        collapsedDepth,
        overscan,
        showDiagnostics,
        collapseUnchanged,
        context,
        minimumHidden,
        step,
        showMinimap,
        ignoreTrailingWhitespace,
        view,
      }),
    [
      sample.format,
      theme,
      lang,
      mode,
      lineHeight,
      collapsedDepth,
      overscan,
      showDiagnostics,
      collapseUnchanged,
      context,
      minimumHidden,
      step,
      showMinimap,
      ignoreTrailingWhitespace,
      view,
    ],
  )

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}logo-${uiTheme}.svg`}
            width={60}
            height={57}
            alt=""
          />
          <div>
            <h1 className="brand-name">Krona</h1>
            <p className="brand-tagline">
              {dict.tagline} ·{' '}
              <a className="ui-link" href="https://github.com/critow/krona#readme">
                {dict.docs}
              </a>
            </p>
          </div>
        </div>

        <div className="head-controls">
          <Segmented
            label={dict.language}
            value={lang}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'ru', label: 'RU' },
            ]}
            onChange={(value) => {
              setLang(value)
              syncUrl({ lang: value })
            }}
          />
          <a className="ui-button" href="https://github.com/critow/krona">
            GitHub
          </a>
          <a className="ui-button" href="https://www.npmjs.com/package/krona">
            npm
          </a>
        </div>
      </header>

      <div className="app-body">
        <div className="stage">
          <Panel
            title={
              <>
                {sample.label}
                <Badge>{sample.format}</Badge>
                <span className="stage-note">{note}</span>
              </>
            }
            actions={
              <Segmented
                label={dict.mode}
                value={mode}
                options={[
                  { value: 'viewer', label: dict.viewer },
                  { value: 'diff', label: dict.diff },
                ]}
                onChange={(value) => {
                  setMode(value)
                  syncUrl({ mode: value })
                }}
              />
            }
          >
            <Krona
              format={sample.format}
              theme={theme}
              locale={lang}
              labels={dict.kronaLabels}
              lineHeight={lineHeight}
              className="stage-krona"
            >
              {mode === 'diff' ? (
                <Krona.Diff
                  key={`${sample.id}-diff`}
                  left={sample.left}
                  right={sample.right}
                  collapseUnchanged={collapseUnchanged && collapseOptions}
                  view={view}
                  showMinimap={showMinimap}
                  ignoreTrailingWhitespace={ignoreTrailingWhitespace}
                  overscan={overscan}
                  {...(collapsedDepth === undefined
                    ? {}
                    : { defaultCollapsedDepth: collapsedDepth })}
                >
                  <Krona.Toolbar />
                  <DiffPanels showMarkers={showMarkers} showMinimap={showMinimap} />
                </Krona.Diff>
              ) : (
                <Krona.Viewer
                  key={`${sample.id}-viewer`}
                  source={sample.left}
                  overscan={overscan}
                  showDiagnostics={showDiagnostics}
                  editable={editable}
                  {...(collapsedDepth === undefined
                    ? {}
                    : { defaultCollapsedDepth: collapsedDepth })}
                >
                  <Krona.Toolbar />
                  {showDiagnostics ? <Krona.Diagnostics /> : null}
                  <Krona.Gutter showMarkers={showMarkers} />
                  <Krona.Lines />
                </Krona.Viewer>
              )}
            </Krona>
          </Panel>

          <Panel title={dict.thisView}>
            <CodeBlock tokens={snippet} />
          </Panel>
        </div>

        <div className="options">
          <Panel title={dict.options}>
            <div className="ui-fields">
              <Field label={dict.sample}>
                <Select
                  value={sample.id}
                  options={SAMPLES.map((s) => ({ value: s.id, label: s.label }))}
                  onChange={(value) => {
                    setSampleId(value)
                    syncUrl({ sample: value })
                  }}
                />
              </Field>
              <Field label={dict.theme}>
                <Select
                  value={theme}
                  options={[
                    { value: 'dark' as Theme, label: dict.dark },
                    { value: 'light' as Theme, label: dict.light },
                    { value: 'auto' as Theme, label: dict.auto },
                  ]}
                  onChange={(value) => {
                    setTheme(value)
                    syncUrl({ theme: value })
                  }}
                />
              </Field>
              <Field label={dict.collapsedDepth}>
                <NumberField
                  value={collapsedDepth}
                  min={0}
                  max={20}
                  placeholder={dict.off}
                  onChange={setCollapsedDepth}
                />
              </Field>
              <Field label={dict.lineHeight}>
                <NumberField
                  value={lineHeight}
                  min={12}
                  max={48}
                  onChange={(v) => setLineHeight(v ?? 20)}
                />
              </Field>
              <Field label={dict.overscan}>
                <NumberField
                  value={overscan}
                  min={0}
                  max={80}
                  onChange={(v) => setOverscan(v ?? 8)}
                />
              </Field>
              {mode === 'diff' ? (
                <>
                  <Field label={dict.layout}>
                    <Select
                      value={view}
                      options={[
                        { value: 'auto' as const, label: dict.auto },
                        { value: 'split' as const, label: dict.split },
                        { value: 'unified' as const, label: dict.unified },
                      ]}
                      onChange={(value) => {
                        setView(value)
                        syncUrl({ view: value })
                      }}
                    />
                  </Field>
                  <Field label={dict.context}>
                    <NumberField
                      value={context}
                      min={0}
                      max={40}
                      onChange={(v) => setContext(v ?? 3)}
                    />
                  </Field>
                  <Field label={dict.minimumHidden}>
                    <NumberField
                      value={minimumHidden}
                      min={1}
                      max={200}
                      onChange={(v) => setMinimumHidden(v ?? 10)}
                    />
                  </Field>
                  <Field label={dict.step}>
                    <NumberField
                      value={step}
                      min={1}
                      max={200}
                      onChange={(v) => setStep(v ?? 20)}
                    />
                  </Field>
                </>
              ) : null}
            </div>

            <div className="ui-checkboxes">
              {mode === 'diff' ? (
                <>
                  <Checkbox
                    checked={collapseUnchanged}
                    onChange={(v) => {
                      setCollapseUnchanged(v)
                      syncUrl({ collapse: v ? 'on' : 'off' })
                    }}
                  >
                    {dict.collapseUnchanged}
                  </Checkbox>
                  <Checkbox
                    checked={showMinimap}
                    onChange={(v) => {
                      setShowMinimap(v)
                      syncUrl({ minimap: v ? 'on' : 'off' })
                    }}
                  >
                    {dict.minimap}
                  </Checkbox>
                  <Checkbox
                    checked={ignoreTrailingWhitespace}
                    onChange={setIgnoreTrailingWhitespace}
                  >
                    {dict.ignoreTrailingWhitespace}
                  </Checkbox>
                </>
              ) : (
                <>
                  <Checkbox checked={showDiagnostics} onChange={setShowDiagnostics}>
                    {dict.showDiagnostics}
                  </Checkbox>
                  <Checkbox checked={editable} onChange={setEditable}>
                    {dict.editable}
                  </Checkbox>
                </>
              )}
              <Checkbox checked={showMarkers} onChange={setShowMarkers}>
                {dict.showMarkers}
              </Checkbox>
            </div>

            <p className="ui-note">
              {editable && mode === 'viewer' ? dict.editableNote : dict.optionsNote}
            </p>
          </Panel>

          <Panel title={dict.install}>
            <pre className="ui-install">
              <code>{'npm i krona\nyarn add krona\npnpm add krona'}</code>
            </pre>
            <p className="ui-note">{dict.installNote}</p>
          </Panel>
        </div>
      </div>

      <footer className="app-foot">
        <span>{dict.footer}</span>
        <span>krona v{__KRONA_VERSION__}</span>
      </footer>
    </div>
  )
}
