import type { KronaLabels } from 'krona'

/**
 * The playground demonstrates that Krona itself ships no i18n runtime:
 * every visible string comes from this plain dictionary and is handed to the
 * library through the `labels` prop.
 */
export type Lang = 'en' | 'ru'

export interface Dict {
  title: string
  mode: string
  viewer: string
  diff: string
  sample: string
  theme: string
  light: string
  dark: string
  language: string
  noDiffSample: string
  kronaLabels: Partial<KronaLabels>
}

const en: Dict = {
  title: 'Krona playground',
  mode: 'Mode',
  viewer: 'Viewer',
  diff: 'Diff',
  sample: 'Sample',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  language: 'Language',
  noDiffSample: 'This sample has no second version to diff against.',
  // English is already Krona's default, so nothing needs overriding here.
  kronaLabels: {},
}

const ruNumbers = new Intl.NumberFormat('ru')

/** Russian needs three plural forms, which is exactly why plurals live in the app. */
function ruLines(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'строка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'строки'
  return 'строк'
}

const ru: Dict = {
  title: 'Песочница Krona',
  mode: 'Режим',
  viewer: 'Просмотр',
  diff: 'Сравнение',
  sample: 'Пример',
  theme: 'Тема',
  light: 'Светлая',
  dark: 'Тёмная',
  language: 'Язык',
  noDiffSample: 'У этого примера нет второй версии для сравнения.',
  kronaLabels: {
    expandAll: 'Развернуть всё',
    collapseAll: 'Свернуть всё',
    expandBlock: 'Развернуть блок',
    collapseBlock: 'Свернуть блок',
    foldedLines: (count) => `${ruNumbers.format(count)} ${ruLines(count)}`,
    hiddenLines: (count) => `${ruNumbers.format(count)} ${ruLines(count)} без изменений`,
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
