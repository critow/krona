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
  expandAll: string
  collapseAll: string
  noDiffSample: string
  kronaLabels: {
    expandAll: string
    collapseAll: string
    expandRange: string
    collapseRange: string
    hiddenLines: (count: string) => string
    expandUp: string
    expandDown: string
    expandAllContext: string
    added: string
    removed: string
    changed: string
    unchanged: string
    leftPanel: string
    rightPanel: string
    changeMap: string
  }
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
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  noDiffSample: 'This sample has no second version to diff against.',
  kronaLabels: {
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    expandRange: 'Expand block',
    collapseRange: 'Collapse block',
    hiddenLines: (count) => `⋯ ${count} lines`,
    expandUp: 'Expand up',
    expandDown: 'Expand down',
    expandAllContext: 'Expand all',
    added: 'Added',
    removed: 'Removed',
    changed: 'Changed',
    unchanged: 'Unchanged',
    leftPanel: 'Left version',
    rightPanel: 'Right version',
    changeMap: 'Change map',
  },
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
  expandAll: 'Развернуть всё',
  collapseAll: 'Свернуть всё',
  noDiffSample: 'У этого примера нет второй версии для сравнения.',
  kronaLabels: {
    expandAll: 'Развернуть всё',
    collapseAll: 'Свернуть всё',
    expandRange: 'Развернуть блок',
    collapseRange: 'Свернуть блок',
    hiddenLines: (count) => `⋯ ${count} строк`,
    expandUp: 'Развернуть вверх',
    expandDown: 'Развернуть вниз',
    expandAllContext: 'Развернуть всё',
    added: 'Добавлено',
    removed: 'Удалено',
    changed: 'Изменено',
    unchanged: 'Без изменений',
    leftPanel: 'Левая версия',
    rightPanel: 'Правая версия',
    changeMap: 'Карта изменений',
  },
}

export const DICTS: Record<Lang, Dict> = { en, ru }
