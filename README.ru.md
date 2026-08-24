# Krona

[English](./README.md) · [Русский](./README.ru.md)

Сворачиваемое дерево и построчный side-by-side diff для конфигурационных файлов
в виде React-компонента. JSON/JSONC, YAML, TOML и INI/.env.

- **Сворачивание как в редакторе.** Объекты, массивы, YAML-блоки, TOML-таблицы и
  INI-секции сворачиваются из гаттера, с плейсхолдером вместо скрытого.
- **Diff как в git.** Построчный, две панели, подсветка изменённых фрагментов
  внутри строки и свёрнутые длинные неизменённые участки.
- **Композиция.** У каждого режима есть раскладка по умолчанию, но он
  разбирается на те же публичные части, если нужна своя.
- **Три рантайм-зависимости.** `jsonc-parser`, `yaml` и `diff` — и всё.

```bash
npm install krona
```

## Быстрый старт

```tsx
import { Krona } from 'krona'

// Просмотр
<Krona format="yaml" theme="dark">
  <Krona.Viewer source={text} defaultCollapsedDepth={2} />
</Krona>

// Сравнение
<Krona format="json" theme="dark">
  <Krona.Diff left={before} right={after} collapseUnchanged />
</Krona>
```

Стили подключаются сами. Для SSR или собственного CSS-пайплайна передайте
`injectStyles={false}` и подключите `import 'krona/styles.css'` вручную.

## Форматы

Импорт `krona` регистрирует **JSON/JSONC**, **TOML** и **INI/.env**. YAML вынесен
в отдельную точку входа: парсер `yaml` весит десятки килобайт и не должен
попадать в бандл тем, кому нужен только JSON:

```tsx
import 'krona/yaml'
```

`format="auto"` определяет формат по содержимому, но только среди реально
импортированных провайдеров — он никогда не «оживит» тот, который вы решили не
включать. Неизвестный формат, битый файл или слишком большой вход деградируют в
plain text с диагностикой, а не в исключение.

| Формат | Сворачивание |
| --- | --- |
| JSON / JSONC | объекты и массивы; комментарии и висящие запятые допустимы |
| YAML | по отступам, блочные скаляры (`\|`, `>`), многострочные flow-коллекции |
| TOML | `[table]` и `[[array of tables]]`, вложенность по составному имени; многострочные строки и массивы |
| INI | `[section]`, вложенность по составному имени |
| .env | нет — в плоском файле нечего сворачивать |

## Своя раскладка

`Krona.Viewer` и `Krona.Diff` без children рисуют раскладку по умолчанию. Если
передать children, вы собираете её сами из тех же публичных частей; между ними
можно класть любой свой JSX.

```tsx
<Krona format="json">
  <Krona.Diff left={before} right={after}>
    <Krona.Toolbar>
      <button onClick={download}>Скачать</button>
    </Krona.Toolbar>
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
</Krona>
```

`Krona.Gutter` и `Krona.Lines` — *одни и те же компоненты* в обоих режимах. Они
читают ближайший источник строк (его даёт сам Viewer или каждая панель Diff), и
потому не знают, в каком режиме находятся. Части сами объявляют, куда они
относятся, — поэтому их можно писать как обычных соседей, и они всё равно
окажутся внутри нужного контейнера прокрутки.

## Хуки

```tsx
const { model, foldState, toggleFold, expandAll, collapseAll } = useKronaViewer()
const { alignedRows, stats, expandContext, toggleRowFold } = useKronaDiff()
```

Оба бросают понятную ошибку вне своего режима.

## Локализация

Внутри Krona **нет i18n-рантайма**. Каждая видимая строка — английский дефолт,
который заменяется через `labels`, так что правила множественного числа и
загрузка переводов остаются в приложении, где им и место. Числа в дефолтных
подписях форматируются через `Intl.NumberFormat` с учётом `locale`.

```tsx
function lines(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'строка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'строки'
  return 'строк'
}

<Krona
  locale="ru"
  labels={{
    collapseAll: 'Свернуть всё',
    expandAll: 'Развернуть всё',
    foldedLines: (n) => `${n} ${lines(n)}`,
  }}
>
  <Krona.Viewer source={text} />
</Krona>
```

## Темы

Всё управляется CSS-переменными `--krona-*`. Переопределите их на любом предке:

```css
.my-viewer {
  --krona-height: 40rem;
  --krona-line-height: 22px;
  --krona-token-key: #b45309;
}
```

`theme="light" | "dark" | "auto"`; `auto` следует за `prefers-color-scheme`.

## Ядро без React

```ts
import { parseDocument, diffLines, alignDiff, intralineDiff } from '@krona/core'
import '@krona/core/yaml'

const doc = parseDocument(source, 'yaml')
doc.lines            // строки исходника
doc.foldingRanges    // сворачиваемые диапазоны
doc.tokensAt(12)     // токены одной строки, лениво и с кэшем

const { rows, stats } = alignDiff(diffLines(before, after))
```

## Большие файлы

Парсинг и diff — линейные проходы, и оба укладываются в бюджет кадра на файле,
относительно которого написан бенчмарк: две версии `package-lock.json` на ~60
тысяч строк.

| | |
| --- | --- |
| разбор 60k строк | ~30 мс |
| diff двух версий по 60k строк | ~62 мс |
| выравнивание diff | ~70 мс |
| токенизация одного экрана | ~29 мс |

Проверить: `pnpm bench`.

YAML — единственный формат, где дополнительно идёт проход валидации ради
сообщений о синтаксических ошибках, и он стоит примерно вдесятеро дороже
структурного разбора. Поэтому он выполняется только до `limits.maxValidatedLength`
(по умолчанию 64 КиБ): любой написанный руками конфиг по-прежнему получает
диагностику, а лок-файл на 67 КБ разбирается за ~6 мс вместо ~51 мс.
Сворачивание и подсветка от валидации не зависят.

Примерно от мегабайта работу стоит унести с основного потока. Модель — обычные
данные, поэтому её можно вернуть из воркера:

```ts
// worker.ts
import { parseDocument, toSnapshot } from '@krona/core'
import '@krona/core/yaml'

self.onmessage = ({ data }) => {
  const model = parseDocument(data.source, data.format)
  self.postMessage(toSnapshot(model))
}
```

```tsx
// app.tsx
import { fromSnapshot } from '@krona/core'

const [model, setModel] = useState<DocumentModel>()
useEffect(() => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => setModel(fromSnapshot(data))
  worker.postMessage({ source, format: 'yaml' })
  return () => worker.terminate()
}, [source])

return model ? (
  <Krona>
    <Krona.Viewer model={model} />
  </Krona>
) : null
```

Сам воркер Krona не создаёт — URL воркера зависит от сборщика, — но пропсы
`model`, `leftModel` и `rightModel` делают этот путь полноценным.

## Проектные решения

**Модель — строки, а не дерево значений.** Diff построчный, сворачивание —
диапазонами, поэтому `строки + диапазоны сворачивания` обслуживают и то, и
другое. Krona никогда не строит JavaScript-объект из вашего файла — поэтому
prototype pollution через ключ `__proto__` здесь просто неприменим.

**Перестановка ключей — настоящее изменение.** Krona сравнивает текст, ровно как
git. Семантический diff скрыл бы изменения, которые в конфиге важны.

**Опасные символы показываются, а не отрисовываются.** Bidi-контролы
([Trojan Source](https://trojansource.codes/), CVE-2021-42574) и невидимые
символы рисуются видимыми плашками `U+XXXX`. Diff, отрисовывающий их как есть,
может показать два разных файла одинаковыми.

**Никакого `innerHTML`.** Содержимое выводится текстовыми нодами React; правило
закреплено линтером.

**Алиасы никогда не разворачиваются.** YAML-бомба стоит не больше своего размера.

**У всего есть лимит.** Размер входа, глубина и количество диапазонов, длина
строки и время diff ограничены — с понятной диагностикой и мягкой деградацией
вместо зависшей вкладки.

## Разработка

```bash
pnpm install
pnpm dev            # песочница на http://localhost:5173
pnpm test           # юнит-тесты (node)
pnpm test:browser   # компонентные тесты в настоящем Chromium — не в jsdom
pnpm test:visual    # попиксельное сравнение скриншотов Playwright
pnpm bench
pnpm verify         # линт, типы, все тесты, сборка
```

Компонентные тесты идут в настоящем браузере намеренно: виртуализация и
синхронный скролл зависят от layout и прокрутки, которых в jsdom нет. Эталонные
скриншоты обновляются только отдельным осознанным коммитом
(`pnpm test:visual:update`).

## Лицензия

MIT
