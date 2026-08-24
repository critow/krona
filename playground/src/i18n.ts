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
  title: 'Песочница Krona',
  mode: 'Режим',
  viewer: 'Просмотр',
  diff: 'Сравнение',
  sample: 'Пример',
  theme: 'Тема',
  light: 'Светлая',
  dark: 'Тёмная',
  language: 'Язык',
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
