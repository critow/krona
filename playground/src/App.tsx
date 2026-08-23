import { Krona } from 'krona'
import { useMemo, useState } from 'react'
import 'krona/yaml'
import { DICTS, type Lang } from './i18n'
import { SAMPLES } from './samples'

type Mode = 'viewer' | 'diff'

export function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [mode, setMode] = useState<Mode>('viewer')
  const [sampleId, setSampleId] = useState(SAMPLES[0]!.id)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const dict = DICTS[lang]
  const sample = useMemo(() => SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!, [sampleId])
  const canDiff = sample.right !== undefined

  return (
    <main className="page" data-theme={theme}>
      <header className="page-header">
        <h1>{dict.title}</h1>
        <div className="controls">
          <label>
            {dict.mode}
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="viewer">{dict.viewer}</option>
              <option value="diff">{dict.diff}</option>
            </select>
          </label>
          <label>
            {dict.sample}
            <select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {dict.theme}
            <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
              <option value="light">{dict.light}</option>
              <option value="dark">{dict.dark}</option>
            </select>
          </label>
          <label>
            {dict.language}
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
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
        {mode === 'viewer' || !canDiff ? (
          <Krona.Viewer key={`${sample.id}-viewer`} source={sample.left}>
            <Krona.Toolbar />
            <Krona.Diagnostics />
            <Krona.Gutter />
            <Krona.Lines />
          </Krona.Viewer>
        ) : null}
      </Krona>

      {mode === 'diff' && !canDiff ? <p className="notice">{dict.noDiffSample}</p> : null}
    </main>
  )
}
