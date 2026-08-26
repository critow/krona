# Справочник Krona

Все пропсы, части, лейблы, CSS-переменные и лимиты разбора.
[README](../README.ru.md) — это обзор, а это указатель, к которому возвращаются.

Проверка в CI вытаскивает публичную поверхность из исходников и падает, когда
какое-то имя перестаёт здесь упоминаться, так что проп не может пройти
недокументированным.

## Справочник пропсов

### `<Krona>`

Корень конфигурации. Держит формат, тему и подписи в контексте и не рисует
ничего, кроме темизированного контейнера; разбор и состояние живут в режимах
внутри.

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `format` | `Format` | `'auto'` | Идентификатор провайдера или `'auto'` — определить среди [зарегистрированных](../README.ru.md#форматы) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | `'auto'` следует за `prefers-color-scheme` |
| `labels` | `Partial<KronaLabels>` | английские дефолты | Все видимые строки — см. [Локализация](#локализация) |
| `locale` | `string` | системная | Локаль BCP 47 для `Intl.NumberFormat` в дефолтных подписях |
| `lineHeight` | `number` | `20` | Высота строки в пикселях; заодно задаёт `--krona-line-height`. Именно фиксированная высота делает виртуализацию точной |
| `narrowWidth` | `number` | `640` | Уже этой ширины режимы верстаются под маленький экран — см. [Маленькие экраны](../README.ru.md#маленькие-экраны). Измеряется по корню, а не по окну; `0` отключает |
| `limits` | `Partial<ParseLimits>` | см. [Лимиты](#лимиты-безопасности) | Переопределение границ парсера |
| `providers` | `FormatRegistry` | модульный реестр | Свой реестр провайдеров |
| `injectStyles` | `boolean` | `true` | Добавляет стили в `document.head` при монтировании |
| `className` / `style` | — | — | На темизированный контейнер |

### `<Krona.Viewer>`

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `source` | `string` | — | Содержимое файла. Передайте это **или** `model` |
| `model` | `DocumentModel` | — | Модель, разобранная снаружи, например [в воркере](../README.ru.md#большие-файлы-и-web-workers). Приоритетнее `source` |
| `format` | `Format` | из `<Krona>` | Переопределяет формат |
| `labels` | `Partial<KronaLabels>` | из `<Krona>` | Переопределяет подписи |
| `defaultCollapsedDepth` | `number` | — | Свернуть все диапазоны этой глубины и глубже — при монтировании и при каждой смене значения; `0` сворачивает всё |
| `overscan` | `number` | `8` | Сколько строк рисовать за пределами вьюпорта |
| `showDiagnostics` | `boolean` | `true` | Показывать ошибки разбора над документом (в раскладке по умолчанию) |
| `showSearch` | `boolean` | `false` | Показывать поле поиска над документом (только в раскладке по умолчанию) |
| `editable` | `boolean` | `false` | Разрешить правку документа — см. [Редактирование](../README.ru.md#редактирование) |
| `onChange` | `(source: string) => void` | — | Вызывается со всем документом после каждой правки, отмены и повтора |
| `className` / `style` | — | — | На область просмотра |
| `children` | `ReactNode` | раскладка по умолчанию | [Своя раскладка](../README.ru.md#своя-раскладка) из тех же публичных частей |

### `<Krona.Diff>`

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `left` / `right` | `string` | — | Две версии. Передайте их **или** пропсы с моделями |
| `leftModel` / `rightModel` | `DocumentModel` | — | Заранее разобранные модели, например [из воркера](../README.ru.md#большие-файлы-и-web-workers) |
| `format` | `Format` | из `<Krona>` | Переопределяет формат |
| `labels` | `Partial<KronaLabels>` | из `<Krona>` | Переопределяет подписи |
| `collapseUnchanged` | `boolean \| CollapseUnchangedOptions` | `false` | Прятать длинные неизменённые участки в разворачиваемую полосу |
| `defaultCollapsedDepth` | `number` | — | Свернуть при загрузке диапазоны этой глубины и глубже |
| `ignoreTrailingWhitespace` | `boolean` | `false` | Сравнивать строки без учёта хвостовых пробелов |
| `view` | `'split' \| 'unified' \| 'auto'` | `'auto'` | Две панели, одна колонка или две до тех пор, пока корень шире `narrowWidth` |
| `showMinimap` | `boolean` | `false` | Показывать миникарту изменений между панелями (раскладка split) |
| `showSearch` | `boolean` | `false` | Показывать поле поиска над панелями |
| `overscan` | `number` | `8` | Сколько строк рисовать за пределами вьюпорта |
| `className` / `style` | — | — | На область сравнения |
| `children` | `ReactNode` | две панели | [Своя раскладка](../README.ru.md#своя-раскладка) |

`CollapseUnchangedOptions`:

| Опция | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `context` | `number` | `3` | Сколько неизменённых строк оставить с каждой стороны изменения |
| `minimumHidden` | `number` | `10` | Самый короткий участок, который стоит прятать; ниже полоса займёт больше места, чем сэкономит |
| `step` | `number` | `20` | Сколько строк открывает одно нажатие кнопок вверх / вниз |

Строку, открывающую диапазон сворачивания, эта свёртка не прячет никогда —
участок разрезается вокруг неё, чтобы шеврон остался доступен.

### Части

Каждая часть принимает `className` и `style`. `Gutter`, `Lines` и `Toolbar` —
*одни и те же компоненты* в обоих режимах: они читают ближайший источник строк и
не знают, в каком режиме находятся.

| Часть | Где место | Примечания |
| --- | --- | --- |
| `Krona.Gutter` | просмотр или панель | Номера строк, маркеры diff, шевроны. `showMarkers?: boolean` |
| `Krona.Lines` | просмотр или панель | Текст документа, подсветка и плейсхолдеры свёрнутого. `showCopyActions?: boolean` |
| `Krona.Toolbar` | над содержимым | Действия сворачивания, а в diff — счётчики изменений. Принимает `children` |
| `Krona.Diagnostics` | над содержимым | Проблемы разбора. `includeWarnings?: boolean` |
| `Krona.Panel` | только diff | Одна сторона. `side: 'left' \| 'right'` |
| `Krona.Unified` | только diff | Обе версии одной колонкой, старая строка над новой; это и рисует `view="unified"` |
| `Krona.Minimap` | только diff | Карта изменений между панелями; вне diff бросает ошибку |
| `Krona.Search` | над содержимым | Поле поиска, счётчик и шаги. `showMatchCase?: boolean`, `autoFocus?: boolean` |
| `Krona.SideSwitch` | только diff | Выбирает версию, которую показывает [узкий](../README.ru.md#маленькие-экраны) дифф. `always?: boolean`; где помещаются обе панели — не рисует ничего |
| `Krona.ExpandBar` | рисуется сама | Полоса скрытых строк; экспортирована для перестилизации |

## Локализация

Внутри Krona **нет i18n-рантайма**. Каждая видимая строка — английский дефолт,
который заменяется через `labels`, так что правила множественного числа и
загрузка переводов остаются в приложении, где им и место. Числа в дефолтных
подписях форматируются через `Intl.NumberFormat` с учётом `locale`.

| Подпись | Сигнатура | Дефолт | Где появляется |
| --- | --- | --- | --- |
| `expandAll` / `collapseAll` | `string` | `Expand all` / `Collapse all` | Тулбар |
| `expandBlock` / `collapseBlock` | `string` | `Expand block` / `Collapse block` | Шеврон в гаттере, доступное имя |
| `foldedItems` | `(count: number) => string` | `6 items` | Плейсхолдер свёрнутого, когда известно число элементов |
| `foldedLines` | `(count: number) => string` | `12 lines` | Плейсхолдер для блочных скаляров |
| `hiddenLines` | `(count: number) => string` | `12 unchanged lines` | Полоса разворачивания в diff |
| `expandUp` / `expandDown` / `expandAllHidden` | `string` | `Expand up` / … | Кнопки на полосе |
| `added` / `removed` / `changed` / `unchanged` | `string` | `Added` / … | Счётчики в тулбаре |
| `leftPanel` / `rightPanel` | `string` | `Previous version` / `Current version` | Доступные имена панелей |
| `changeMap` | `string` | `Change map` | Доступное имя миникарты |
| `unsafeCharacter` | `(code: string) => string` | `Hidden character U+202E` | Подсказка на плашке опасного символа |
| `document` | `string` | `Configuration file` | Доступное имя области |
| `editValue` | `string` | `Edit value` | Подсказка на редактируемом значении |
| `editLine` | `string` | `Edit line` | Действие строки: открыть её как текст |
| `editBlock` | `string` | `Edit block` | Действие строки: открыть блок как текст |
| `deleteEntry` | `string` | `Delete` | Действие строки: удалить запись |
| `saveEdit` | `string` | `Save` | Применяет открытый редактор |
| `cancelEdit` | `string` | `Cancel` | Отменяет открытый редактор |
| `undo` | `string` | `Undo` | Действие тулбара: отменить последнюю правку |
| `redo` | `string` | `Redo` | Действие тулбара: повторить отменённое |
| `duplicateEntry` | `string` | `Duplicate` | Действие строки: повторить запись ниже |
| `copyEntry` | `string` | `Copy` | Действие строки: скопировать запись или блок |
| `copyValue` | `string` | `Copy value` | Действие строки: скопировать только значение |
| `copyPath` | `string` | `Copy path` | Действие строки: скопировать путь до строки |
| `copied` | `string` | `Copied` | Ненадолго показывается после копирования |
| `search` | `string` | `Search` | Плейсхолдер и доступное имя поля поиска |
| `nextMatch` / `previousMatch` | `string` | `Next match` / `Previous match` | Кнопки шага по совпадениям |
| `matchCase` | `string` | `Match case` | Переключатель учёта регистра |
| `matchCount` | `(position: number, total: number, more: boolean) => string` | `3 / 17` | Счётчик совпадений; `more` — когда число это нижняя граница |
| `noMatches` | `string` | `No matches` | Показывается и озвучивается, когда ничего не найдено |

Русскому нужны три формы множественного числа — ровно поэтому склонения живут в
приложении, а не в библиотеке:

```tsx
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

<Krona
  locale="ru"
  labels={{
    collapseAll: 'Свернуть всё',
    expandAll: 'Развернуть всё',
    foldedItems: (n) => `${n} ${plural(n, 'элемент', 'элемента', 'элементов')}`,
  }}
>
  <Krona.Viewer source={text} />
</Krona>
```

## Темы

Всё управляется CSS-переменными `--krona-*`. Переопределите их на любом предке —
трогать селекторы не нужно.

```css
.my-viewer {
  --krona-height: 40rem;
  --krona-line-height: 22px;
  --krona-font-family: 'JetBrains Mono', monospace;
  --krona-token-key: #b45309;
}
```

| Группа | Переменные |
| --- | --- |
| Раскладка | `--krona-height`, `--krona-line-height`, `--krona-font-family`, `--krona-font-size`, `--krona-gutter-width`, `--krona-padding-inline` |
| Поверхности | `--krona-bg`, `--krona-bg-gutter`, `--krona-bg-hover`, `--krona-border`, `--krona-fg`, `--krona-fg-muted` |
| Контролы | `--krona-chevron`, `--krona-chevron-hover`, `--krona-scrollbar` |
| Поиск | `--krona-match-bg`, `--krona-match-current-bg` |
| Токены | `--krona-token-key`, `-string`, `-number`, `-boolean`, `-null`, `-comment`, `-punctuation`, `-section` |
| Diff | `--krona-added-bg`, `--krona-added-strong-bg`, `--krona-removed-bg`, `--krona-removed-strong-bg`, `--krona-spacer-bg`, `--krona-added-marker`, `--krona-removed-marker` |
| Предупреждения | `--krona-unsafe-bg`, `--krona-unsafe-fg` |
| Тултипы | `--krona-tooltip-bg`, `--krona-tooltip-fg` |

`theme="light" \| "dark" \| "auto"`; `auto` следует за `prefers-color-scheme`.

![Тот же diff в светлой теме, неизменённые участки свёрнуты](./docs/assets/diff-light.png)

## Лимиты безопасности

Содержимое файла — всегда недоверенные данные. У каждой границы ниже есть
дефолт, она настраивается через `limits` и деградирует с внятной диагностикой, а
не зависшей вкладкой.

| Лимит | Дефолт | Что происходит за ним |
| --- | --- | --- |
| `maxInputLength` | 10 МиБ | Plain text, без сворачивания и подсветки, диагностика-ошибка |
| `maxDepth` | 64 | Более глубокие диапазоны отбрасываются, диагностика-предупреждение |
| `maxFoldRanges` | 200 000 | Сворачивание прекращается, диагностика-предупреждение |
| `maxTokenizedLineLength` | 10 000 | Такая строка рисуется без подсветки |
| `maxValidatedLength` | 64 КиБ | YAML пропускает проход валидации; на сворачивание и подсветку это не влияет |

У diff свой бюджет: Майерс — O(ND), поэтому `timeout` (по умолчанию 1500 мс)
переключает на приближение по общему префиксу и суффиксу — ровно тот же размен,
который делает git, когда его эвристики сдаются.
