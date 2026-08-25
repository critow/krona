import { Krona } from 'krona'
import 'krona/yaml'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DICTS, type Lang } from './i18n'
import { SAMPLES } from './samples'
import { buildSnippet } from './snippet'
import { Badge, CodeBlock, Panel, Segmented, Switch } from './ui/kit'

type Mode = 'viewer' | 'diff'
type Theme = 'light' | 'dark'

/**
 * The page state lives in the query string so the visual-regression suite can
 * navigate straight to a reference view, and so a link to the demo carries what
 * the sender was looking at.
 */
function readParams() {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  const sample = params.get('sample')
  return {
    mode: params.get('mode') === 'viewer' ? ('viewer' as Mode) : ('diff' as Mode),
    sampleId: SAMPLES.some((s) => s.id === sample) ? (sample as string) : (SAMPLES[0]?.id ?? ''),
    theme: params.get('theme') === 'light' ? ('light' as Theme) : ('dark' as Theme),
    lang: params.get('lang') === 'ru' ? ('ru' as Lang) : ('en' as Lang),
    collapse: params.get('collapse') !== 'off',
    minimap: params.get('minimap') !== 'off',
  }
}

export function App() {
  const initial = useMemo(readParams, [])
  const [lang, setLang] = useState<Lang>(initial.lang)
  const [mode, setMode] = useState<Mode>(initial.mode)
  const [sampleId, setSampleId] = useState(initial.sampleId)
  const [theme, setTheme] = useState<Theme>(initial.theme)
  const [collapseUnchanged, setCollapseUnchanged] = useState(initial.collapse)
  const [showMinimap, setShowMinimap] = useState(initial.minimap)

  const dict = DICTS[lang]
  const sample = useMemo(() => SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!, [sampleId])

  useEffect(() => {
    document.documentElement.dataset.uiTheme = theme
  }, [theme])

  const syncUrl = useCallback((next: Record<string, string>) => {
    const params = new URLSearchParams(globalThis.location.search)
    for (const [key, value] of Object.entries(next)) params.set(key, value)
    history.replaceState(null, '', `?${params.toString()}`)
  }, [])

  const snippet = useMemo(
    () =>
      buildSnippet({
        format: sample.format,
        theme,
        mode,
        collapseUnchanged,
        showMinimap,
        collapsedDepth: undefined,
        yaml: sample.format === 'yaml',
      }),
    [sample.format, theme, mode, collapseUnchanged, showMinimap],
  )

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {'{ }'}
          </span>
          <div>
            <h1 className="brand-name">Krona</h1>
            <p className="brand-tagline">{dict.tagline}</p>
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
          <Segmented
            label={dict.theme}
            value={theme}
            options={[
              { value: 'dark', label: dict.dark },
              { value: 'light', label: dict.light },
            ]}
            onChange={(value) => {
              setTheme(value)
              syncUrl({ theme: value })
            }}
          />
          <a className="ui-button" href="https://github.com/critow/krona">
            GitHub
          </a>
        </div>
      </header>

      <div className="app-body">
        <Panel className="sidebar" title={dict.samples}>
          <ul className="ui-samples">
            {SAMPLES.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="ui-sample"
                  aria-current={item.id === sample.id}
                  onClick={() => {
                    setSampleId(item.id)
                    syncUrl({ sample: item.id })
                  }}
                >
                  <span className="ui-sample-name">
                    {item.label}
                    <Badge>{item.format}</Badge>
                  </span>
                  <span className="ui-sample-note">{dict.notes[item.id] ?? item.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="stage">
          <Panel
            title={
              <>
                {sample.label}
                <span className="stage-note">{dict.notes[sample.id] ?? sample.note}</span>
              </>
            }
            actions={
              <div className="stage-controls">
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
                {mode === 'diff' ? (
                  <>
                    <Switch
                      checked={collapseUnchanged}
                      onChange={(value) => {
                        setCollapseUnchanged(value)
                        syncUrl({ collapse: value ? 'on' : 'off' })
                      }}
                    >
                      {dict.collapseUnchanged}
                    </Switch>
                    <Switch
                      checked={showMinimap}
                      onChange={(value) => {
                        setShowMinimap(value)
                        syncUrl({ minimap: value ? 'on' : 'off' })
                      }}
                    >
                      {dict.minimap}
                    </Switch>
                  </>
                ) : null}
              </div>
            }
          >
            <Krona
              format={sample.format}
              theme={theme}
              locale={lang}
              labels={dict.kronaLabels}
              className="stage-krona"
            >
              {mode === 'diff' ? (
                <Krona.Diff
                  key={`${sample.id}-diff`}
                  left={sample.left}
                  right={sample.right}
                  collapseUnchanged={collapseUnchanged}
                  showMinimap={showMinimap}
                >
                  <Krona.Toolbar />
                  <Krona.Panel side="left">
                    <Krona.Gutter />
                    <Krona.Lines />
                  </Krona.Panel>
                  {showMinimap ? <Krona.Minimap /> : null}
                  <Krona.Panel side="right">
                    <Krona.Gutter />
                    <Krona.Lines />
                  </Krona.Panel>
                </Krona.Diff>
              ) : (
                <Krona.Viewer key={`${sample.id}-viewer`} source={sample.left}>
                  <Krona.Toolbar />
                  <Krona.Diagnostics />
                  <Krona.Gutter />
                  <Krona.Lines />
                </Krona.Viewer>
              )}
            </Krona>
          </Panel>

          <Panel title={dict.thisView}>
            <CodeBlock tokens={snippet} />
          </Panel>
        </div>
      </div>

      <footer className="app-foot">{dict.footer}</footer>
    </div>
  )
}
