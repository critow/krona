import { Krona } from 'krona'
import 'krona/yaml'
import { useCallback, useMemo, useState } from 'react'
import { DICTS, type Lang } from './i18n'
import { SAMPLES } from './samples'

type Mode = 'viewer' | 'diff'
type Theme = 'light' | 'dark'

/**
 * The initial state comes from the query string so the visual-regression suite
 * can navigate straight to a reference view (`?mode=diff&sample=reordered`).
 */
function readParams() {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  const sample = params.get('sample')
  return {
    mode: params.get('mode') === 'diff' ? ('diff' as Mode) : ('viewer' as Mode),
    sampleId: SAMPLES.some((s) => s.id === sample) ? (sample as string) : (SAMPLES[0]?.id ?? ''),
    theme: params.get('theme') === 'dark' ? ('dark' as Theme) : ('light' as Theme),
    lang: params.get('lang') === 'ru' ? ('ru' as Lang) : ('en' as Lang),
    collapse: params.get('collapse') !== 'off',
  }
}

export function App() {
  const initial = useMemo(readParams, [])
  const [lang, setLang] = useState<Lang>(initial.lang)
  const [mode, setMode] = useState<Mode>(initial.mode)
  const [sampleId, setSampleId] = useState(initial.sampleId)
  const [theme, setTheme] = useState<Theme>(initial.theme)

  const dict = DICTS[lang]
  const sample = useMemo(() => SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!, [sampleId])

  const syncUrl = useCallback(
    (next: Partial<{ mode: Mode; sample: string; theme: Theme; lang: Lang }>) => {
      const params = new URLSearchParams(globalThis.location.search)
      for (const [key, value] of Object.entries(next)) params.set(key, String(value))
      history.replaceState(null, '', `?${params.toString()}`)
    },
    [],
  )

  return (
    <main className="page" data-theme={theme}>
      <header className="page-header">
        <h1>{dict.title}</h1>
        <div className="controls">
          <label>
            {dict.mode}
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as Mode)
                syncUrl({ mode: e.target.value as Mode })
              }}
            >
              <option value="viewer">{dict.viewer}</option>
              <option value="diff">{dict.diff}</option>
            </select>
          </label>
          <label>
            {dict.sample}
            <select
              value={sampleId}
              onChange={(e) => {
                setSampleId(e.target.value)
                syncUrl({ sample: e.target.value })
              }}
            >
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {dict.theme}
            <select
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value as Theme)
                syncUrl({ theme: e.target.value as Theme })
              }}
            >
              <option value="light">{dict.light}</option>
              <option value="dark">{dict.dark}</option>
            </select>
          </label>
          <label>
            {dict.language}
            <select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value as Lang)
                syncUrl({ lang: e.target.value as Lang })
              }}
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
        </div>
      </header>

      <Krona
        format={sample.format}
        theme={theme}
        locale={lang}
        labels={dict.kronaLabels}
        style={{ ['--krona-height' as string]: '70vh' }}
      >
        {mode === 'diff' ? (
          <Krona.Diff
            key={`${sample.id}-diff`}
            left={sample.left}
            right={sample.right}
            collapseUnchanged={initial.collapse}
            showMinimap
          >
            <Krona.Toolbar />
            <Krona.Panel side="left">
              <Krona.Gutter />
              <Krona.Lines />
            </Krona.Panel>
            <Krona.Minimap />
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
    </main>
  )
}
