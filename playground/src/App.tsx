import { alignDiff, detectFormat, diffLines, Krona, unifiedPatch, useKronaDiff } from 'kronajs'
import 'kronajs/yaml'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DICTS, type Lang } from './i18n'
import { SAMPLES } from './samples'
import { buildSnippet } from './snippet'
import {
  Badge,
  Button,
  Checkbox,
  CodeBlock,
  Field,
  NumberField,
  Panel,
  Segmented,
  Select,
} from './ui/kit'

type Mode = 'viewer' | 'diff'
type Theme = 'light' | 'dark' | 'auto'

/**
 * Page state lives in the query string, so the visual-regression suite can
 * navigate straight to a reference view and a link carries what the sender was
 * looking at.
 */
function readParams() {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  // `#L42` is the shape every code host uses, so it is the shape a reader
  // already knows how to type and how to read back out of a shared link. In a
  // diff the letter names the version too, as it does on GitHub: `L` is the
  // previous one, `R` the current.
  const line = /^#([LR])(\d+)$/.exec(globalThis.location?.hash ?? '')
  const sample = params.get('sample')
  const theme = params.get('theme')
  return {
    mode: params.get('mode') === 'viewer' ? ('viewer' as Mode) : ('diff' as Mode),
    sampleId: SAMPLES.some((s) => s.id === sample) ? (sample as string) : (SAMPLES[0]?.id ?? ''),
    theme: theme === 'light' || theme === 'auto' ? (theme as Theme) : ('dark' as Theme),
    lang: params.get('lang') === 'ru' ? ('ru' as Lang) : ('en' as Lang),
    line: line ? Number(line[2]) : 0,
    side: line?.[1] === 'L' ? ('left' as const) : ('right' as const),
    collapse: params.get('collapse') !== 'off',
    minimap: params.get('minimap') !== 'off',
    search: params.get('search') === 'on',
    editable: params.get('edit') === 'on',
    depth: params.get('depth') === 'off' ? undefined : Number(params.get('depth') ?? 2),
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

/**
 * The sample id that means "whatever the reader pasted".
 *
 * A file the reader brings is the only one that proves the thing works on their
 * configuration rather than on ours, so it is one of the ways in rather than a
 * feature hidden behind a menu.
 */
const OWN = 'own'

/**
 * A file name for the patch headers.
 *
 * `git apply` strips one leading path component, so the names have to carry one
 * — a bare `a` and `b` would leave it with nothing. Samples are labelled with
 * their file name where they have one; the rest are described rather than
 * named, and get a name from their format instead.
 */
function patchName(label: string, format: string): string {
  const first = label.split(' ')[0] ?? ''
  return first.includes('.') ? first : `config.${format}`
}

/** Text held between reloads, when the browser allows it. */
function readStored(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key) ?? ''
  } catch {
    // A private window, or site data switched off. The demo works without it.
    return ''
  }
}

function store(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Nothing to do: the page keeps the text in memory either way.
  }
}

/**
 * What each hero tab opens.
 *
 * A preset is not a mode of the demo: it is a handful of the same props the
 * Options panel sets by hand, so pressing one and then reading the generated
 * snippet shows exactly what produced it.
 */
const PRESETS = {
  fold: { mode: 'viewer' as const, sample: 'json', editable: false, depth: 2 },
  diff: { mode: 'diff' as const, sample: 'json', editable: false, depth: 2 },
  edit: { mode: 'viewer' as const, sample: 'json', editable: true, depth: undefined },
  large: { mode: 'viewer' as const, sample: 'big', editable: false, depth: 2 },
  own: { mode: 'viewer' as const, sample: OWN, editable: true, depth: undefined },
}

type PresetId = keyof typeof PRESETS

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
  const [showSearch, setShowSearch] = useState(initial.search)
  const [showDiagnostics, setShowDiagnostics] = useState(true)
  const [editable, setEditable] = useState(initial.editable)
  const [showMarkers, setShowMarkers] = useState(true)
  const [ignoreTrailingWhitespace, setIgnoreTrailingWhitespace] = useState(false)
  // The demo lands partially collapsed on purpose: with everything expanded
  // there is nothing to notice, and the fold controls read as decoration.
  const [collapsedDepth, setCollapsedDepth] = useState<number | undefined>(initial.depth)
  const [lineHeight, setLineHeight] = useState(20)
  const [overscan, setOverscan] = useState(8)
  const [context, setContext] = useState(3)
  const [minimumHidden, setMinimumHidden] = useState(10)
  const [step, setStep] = useState(20)

  const dict = DICTS[lang]
  const [ownLeft, setOwnLeft] = useState(() => readStored('krona:own-left'))
  const [ownRight, setOwnRight] = useState(() => readStored('krona:own-right'))

  // The pasted file is a sample like any other, so nothing downstream has to
  // know where the text came from — including the snippet builder.
  const sample = useMemo(() => {
    if (sampleId !== OWN) return SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]!
    const text = ownLeft || ownRight
    return {
      id: OWN,
      label: dict.yourFile,
      // Detected from the text, not from a file name the page does not have.
      format: text ? detectFormat(text, text.split('\n')) : 'json',
      left: ownLeft,
      right: ownRight || ownLeft,
      note: dict.yourFileNote,
    }
  }, [sampleId, ownLeft, ownRight, dict])

  const note = sampleId === OWN ? dict.yourFileNote : (dict.notes[sample.id] ?? sample.note)

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
    document.title = dict.documentTitle
    document.documentElement.lang = lang
  }, [dict.tagline, lang])

  const activePreset = (Object.keys(PRESETS) as PresetId[]).find((id) => {
    const preset = PRESETS[id]
    return (
      preset.mode === mode &&
      preset.sample === sampleId &&
      preset.editable === editable &&
      preset.depth === collapsedDepth
    )
  })

  const [selectedLine, setSelectedLine] = useState(initial.line)
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>(initial.side)

  // The address bar is the link. Writing the line there rather than into a
  // clipboard means the reader copies it the way they copy any other URL, and
  // the demo does not have to explain itself.
  const selectLine = useCallback((value: number, side: 'left' | 'right' = 'right') => {
    setSelectedLine(value)
    setSelectedSide(side)
    history.replaceState(
      null,
      '',
      `${globalThis.location.search}#${side === 'left' ? 'L' : 'R'}${value}`,
    )
  }, [])

  // One document has no version to name, so its links stay `#L42` — the shape
  // the viewer has always written.
  const selectViewerLine = useCallback((value: number) => {
    setSelectedLine(value)
    setSelectedSide('right')
    history.replaceState(null, '', `${globalThis.location.search}#L${value}`)
  }, [])

  // What came of the last copy, shown next to the button rather than in an
  // alert: a copy that quietly failed is the one thing a copy button must not
  // do, and a browser is allowed to refuse the clipboard outright.
  const [patchNote, setPatchNote] = useState('')

  const copyPatch = useCallback(async () => {
    const result = diffLines(sample.left, sample.right, { ignoreTrailingWhitespace })
    const { rows } = alignDiff(result)
    const name = patchName(sample.label, sample.format)
    // The same lines the panels are showing, written as one column. Folding and
    // collapsed runs are left out of it on purpose: they hide lines from the
    // eye, not from the file.
    const patch = unifiedPatch(rows, result.left, result.right, {
      from: `a/${name}`,
      to: `b/${name}`,
    })
    if (!patch) {
      setPatchNote(dict.patchEmpty)
      return
    }
    try {
      await navigator.clipboard.writeText(patch)
      setPatchNote(dict.patchCopied)
    } catch {
      setPatchNote(dict.patchRefused)
    }
  }, [sample, ignoreTrailingWhitespace, dict])

  // A note about a copy is about that copy; anything that changes what would be
  // copied makes it stale.
  useEffect(() => {
    setPatchNote('')
  }, [sample, ignoreTrailingWhitespace, mode, lang])

  const syncUrl = useCallback((next: Record<string, string>) => {
    const params = new URLSearchParams(globalThis.location.search)
    for (const [key, value] of Object.entries(next)) params.set(key, value)
    history.replaceState(null, '', `?${params.toString()}`)
  }, [])

  const applyPreset = useCallback(
    (id: PresetId) => {
      const preset = PRESETS[id]
      setMode(preset.mode)
      setSampleId(preset.sample)
      setEditable(preset.editable)
      setCollapsedDepth(preset.depth)
      syncUrl({
        mode: preset.mode,
        sample: preset.sample,
        edit: preset.editable ? 'on' : 'off',
        depth: preset.depth === undefined ? 'off' : String(preset.depth),
      })
    },
    [syncUrl],
  )

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
            <p className="brand-formats">JSON · YAML · TOML · INI/.env — React</p>
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
          <a className="ui-button" href="https://www.npmjs.com/package/kronajs">
            npm
          </a>
        </div>
      </header>

      <nav className="presets" aria-label={dict.mode}>
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={activePreset === id ? 'ui-button preset preset--on' : 'ui-button preset'}
            aria-pressed={activePreset === id}
            onClick={() => applyPreset(id)}
          >
            {dict.presets[id]}
          </button>
        ))}
        <span className="presets-note">{dict.presetsNote}</span>
      </nav>

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
              <>
                {mode === 'diff' ? (
                  <>
                    {patchNote ? (
                      <span className="stage-note" role="status">
                        {patchNote}
                      </span>
                    ) : null}
                    <Button
                      onClick={() => {
                        void copyPatch()
                      }}
                    >
                      {dict.copyPatch}
                    </Button>
                  </>
                ) : null}
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
              </>
            }
          >
            {sampleId === OWN ? (
              <div className="paste">
                <label className="paste-field">
                  <span className="paste-label">
                    {mode === 'diff' ? dict.before : dict.yourFile}
                  </span>
                  <textarea
                    className="paste-input"
                    value={ownLeft}
                    spellCheck={false}
                    placeholder={dict.pastePlaceholder}
                    onChange={(event) => {
                      setOwnLeft(event.target.value)
                      store('krona:own-left', event.target.value)
                    }}
                  />
                </label>
                {mode === 'diff' ? (
                  <label className="paste-field">
                    <span className="paste-label">{dict.after}</span>
                    <textarea
                      className="paste-input"
                      value={ownRight}
                      spellCheck={false}
                      placeholder={dict.pastePlaceholder}
                      onChange={(event) => {
                        setOwnRight(event.target.value)
                        store('krona:own-right', event.target.value)
                      }}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
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
                  showSearch={showSearch}
                  ignoreTrailingWhitespace={ignoreTrailingWhitespace}
                  overscan={overscan}
                  onSelectLine={selectLine}
                  selectedSide={selectedSide}
                  {...(selectedLine > 0 ? { selectedLine } : {})}
                  {...(collapsedDepth === undefined
                    ? {}
                    : { defaultCollapsedDepth: collapsedDepth })}
                >
                  {showSearch ? <Krona.Search /> : null}
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
                  onSelectLine={selectViewerLine}
                  {...(selectedLine > 0 ? { selectedLine } : {})}
                  {...(collapsedDepth === undefined
                    ? {}
                    : { defaultCollapsedDepth: collapsedDepth })}
                >
                  {showSearch ? <Krona.Search /> : null}
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
                  options={[
                    ...SAMPLES.map((s) => ({ value: s.id, label: s.label })),
                    { value: OWN, label: dict.yourFile },
                  ]}
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
              {/* Outside the branch: searching is something both modes do. */}
              <Checkbox
                checked={showSearch}
                onChange={(v) => {
                  setShowSearch(v)
                  syncUrl({ search: v ? 'on' : 'off' })
                }}
              >
                {dict.search}
              </Checkbox>
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
              <code>{'npm i kronajs\nyarn add kronajs\npnpm add kronajs'}</code>
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
