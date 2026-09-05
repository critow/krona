import type { KronaLabels } from 'kronajs'

/**
 * The playground demonstrates that Krona itself ships no i18n runtime:
 * every visible string comes from this plain dictionary and is handed to the
 * library through the `labels` prop.
 */
export type Lang = 'en' | 'ru'

export interface Dict {
  tagline: string
  /**
   * What the browser tab and a search result say. Kept apart from `tagline`,
   * which is the headline on the page: a heading can be a claim, but the title
   * is read by people scanning a result list, so it names the formats they
   * were searching for.
   */
  documentTitle: string
  docs: string
  mode: string
  viewer: string
  diff: string
  options: string
  sample: string
  theme: string
  light: string
  dark: string
  auto: string
  off: string
  language: string
  collapsedDepth: string
  lineHeight: string
  overscan: string
  context: string
  minimumHidden: string
  step: string
  collapseUnchanged: string
  minimap: string
  search: string
  /** Hero: what each preset opens. */
  presets: { fold: string; diff: string; edit: string; large: string; own: string }
  presetsNote: string
  /** The reader's own file, pasted into the page. */
  yourFile: string
  yourFileNote: string
  pastePlaceholder: string
  /** Writing the pasted document the way its format is usually written. */
  formatDocument: string
  formatUnsupported: string
  before: string
  after: string
  detected: string
  /** Writing the diff out as a patch, and what came of it. */
  copyPatch: string
  patchCopied: string
  patchRefused: string
  patchEmpty: string
  layout: string
  split: string
  unified: string
  ignoreTrailingWhitespace: string
  showDiagnostics: string
  editable: string
  editableNote: string
  showMarkers: string
  optionsNote: string
  install: string
  installNote: string
  thisView: string
  footer: string
  /** Per-sample notes, keyed by sample id; falls back to the sample's own note. */
  notes: Record<string, string>
  kronaLabels: Partial<KronaLabels>
}

const en: Dict = {
  tagline: 'Fold, diff and edit config files',
  documentTitle: 'Krona — JSON, YAML, TOML and INI viewer and diff for React',
  docs: 'Docs',
  mode: 'Mode',
  viewer: 'Viewer',
  diff: 'Diff',
  options: 'Options',
  sample: 'Sample',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
  off: 'off',
  language: 'Language',
  collapsedDepth: 'Collapse from depth',
  lineHeight: 'Line height',
  overscan: 'Overscan rows',
  context: 'Context lines',
  minimumHidden: 'Minimum hidden',
  step: 'Expand step',
  collapseUnchanged: 'Fold unchanged',
  minimap: 'Minimap',
  search: 'Search box',
  presets: { fold: 'Fold', diff: 'Compare', edit: 'Edit', large: '60k lines', own: 'Your file' },
  presetsNote: 'Every one of these is the same component, with different props.',
  yourFile: 'Your file',
  yourFileNote: 'Paste a config. The format is detected from the text; nothing leaves the page.',
  pastePlaceholder: 'Paste JSON, JSON5, YAML, TOML, INI, XML, HCL or .properties here',
  formatDocument: 'Format',
  formatUnsupported: 'Krona has no formatter for this format yet',
  before: 'Before',
  after: 'After',
  detected: 'detected',
  copyPatch: 'Copy patch',
  patchCopied: 'Patch copied',
  patchRefused: 'The browser refused the clipboard',
  patchEmpty: 'Nothing to patch',
  layout: 'Layout',
  split: 'Split',
  unified: 'Unified',
  ignoreTrailingWhitespace: 'Ignore trailing space',
  showDiagnostics: 'Show diagnostics',
  editable: 'Editable',
  editableNote:
    'Double-click a value to edit it; hover a line for its actions. Undo and redo are in the toolbar.',
  showMarkers: 'Gutter markers',
  optionsNote:
    'Every control here is a real prop. The code below updates with them, so whatever you end up with is copy-pasteable.',
  install: 'Install',
  installNote:
    'YAML lives behind kronajs/yaml so its parser never reaches a bundle that only shows JSON.',
  thisView: 'This view, in code',
  footer: 'JSON · YAML · TOML · INI/.env — three runtime dependencies, no innerHTML.',
  notes: {},
  // English is already Krona's default, so nothing needs overriding here.
  kronaLabels: {},
}

const ruNumbers = new Intl.NumberFormat('ru')

/** Russian needs three plural forms, which is exactly why plurals live in the app. */
function ruPlural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const ru: Dict = {
  tagline: 'Свернуть, сравнить и отредактировать конфиг',
  documentTitle: 'Krona — просмотр и diff JSON, YAML, TOML и INI для React',
  docs: 'Документация',
  mode: 'Режим',
  viewer: 'Просмотр',
  diff: 'Сравнение',
  options: 'Настройки',
  sample: 'Пример',
  theme: 'Тема',
  light: 'Светлая',
  dark: 'Тёмная',
  auto: 'Системная',
  off: 'выкл',
  language: 'Язык',
  collapsedDepth: 'Сворачивать с глубины',
  lineHeight: 'Высота строки',
  overscan: 'Запас строк',
  context: 'Строк контекста',
  minimumHidden: 'Минимум скрытых',
  step: 'Шаг разворота',
  collapseUnchanged: 'Сворачивать неизменённое',
  minimap: 'Миникарта',
  search: 'Поиск',
  presets: {
    fold: 'Свернуть',
    diff: 'Сравнить',
    edit: 'Править',
    large: '60k строк',
    own: 'Свой файл',
  },
  presetsNote: 'Всё это — один и тот же компонент с разными пропсами.',
  yourFile: 'Свой файл',
  yourFileNote: 'Вставьте конфиг. Формат определяется по тексту; со страницы ничего не уходит.',
  pastePlaceholder: 'Вставьте сюда JSON, JSON5, YAML, TOML, INI, XML, HCL или .properties',
  formatDocument: 'Форматировать',
  formatUnsupported: 'Для этого формата у Krona пока нет форматтера',
  before: 'Было',
  after: 'Стало',
  detected: 'определён',
  copyPatch: 'Скопировать патч',
  patchCopied: 'Патч скопирован',
  patchRefused: 'Браузер не дал доступ к буферу',
  patchEmpty: 'Патчить нечего',
  layout: 'Раскладка',
  split: 'Рядом',
  unified: 'Одной колонкой',
  ignoreTrailingWhitespace: 'Без хвостовых пробелов',
  showDiagnostics: 'Показывать диагностику',
  editable: 'Редактируемый',
  editableNote:
    'Двойной клик по значению правит его; наведите на строку, чтобы увидеть её действия. Отмена и повтор — в тулбаре.',
  showMarkers: 'Маркеры в гаттере',
  optionsNote:
    'Каждый контрол здесь — настоящий проп. Код ниже меняется вместе с ними, так что получившееся можно скопировать как есть.',
  install: 'Установка',
  installNote:
    'YAML вынесен в kronajs/yaml, чтобы его парсер не попадал в бандл тем, кому нужен только JSON.',
  thisView: 'Этот экран в коде',
  footer: 'JSON · YAML · TOML · INI/.env — три зависимости, никакого innerHTML.',
  notes: {
    json: 'Комментарии и висящие запятые переживают разбор; объекты и массивы сворачиваются.',
    yaml: 'Блочные скаляры и якоря, свёртка по отступам.',
    toml: 'Таблицы вкладываются по составному имени, массивы таблиц остаются соседями.',
    ini: 'Секции сворачиваются, составные имена вкладываются.',
    env: 'Плоский по устройству — сворачивать нечего, только подсветка.',
    json5: 'Ключи без кавычек, одинарные кавычки, hex-числа и комментарии.',
    xml: 'Элементы сворачиваются от открывающего тега до закрывающего.',
    hcl: 'Блоки сворачиваются вместе с метками; heredoc — одна запись.',
    properties: 'Значение, продолженное на несколько строк, сворачивается в одну.',
    reordered: 'Перестановка ключа — настоящее изменение, ровно как в git.',
    unrelated: 'Два файла без общего.',
    big: '28 тысяч строк, виртуализация; точечное обновление зависимостей.',
    collapsed: 'Одно изменение в длинном файле, неизменённое свёрнуто.',
  },
  kronaLabels: {
    expandAll: 'Развернуть всё',
    collapseAll: 'Свернуть всё',
    expandBlock: 'Развернуть блок',
    collapseBlock: 'Свернуть блок',
    foldedItems: (count) =>
      `${ruNumbers.format(count)} ${ruPlural(count, 'элемент', 'элемента', 'элементов')}`,
    foldedLines: (count) =>
      `${ruNumbers.format(count)} ${ruPlural(count, 'строка', 'строки', 'строк')}`,
    hiddenLines: (count) =>
      `${ruNumbers.format(count)} ${ruPlural(count, 'строка', 'строки', 'строк')} без изменений`,
    search: 'Поиск',
    nextMatch: 'Следующее совпадение',
    previousMatch: 'Предыдущее совпадение',
    matchCase: 'Учитывать регистр',
    matchCount: (position, total, more) =>
      `${ruNumbers.format(position)} / ${ruNumbers.format(total)}${more ? '+' : ''}`,
    noMatches: 'Ничего не найдено',
    expandUp: 'Развернуть вверх',
    expandDown: 'Развернуть вниз',
    expandAllHidden: 'Развернуть всё',
    added: 'Добавлено',
    removed: 'Удалено',
    changed: 'Изменено',
    unchanged: 'Без изменений',
    leftPanel: 'Предыдущая версия',
    rightPanel: 'Текущая версия',
    changeMap: 'Карта изменений',
    unsafeCharacter: (code) => `Скрытый символ ${code}`,
    document: 'Конфигурационный файл',
  },
}

export const DICTS: Record<Lang, Dict> = { en, ru }
