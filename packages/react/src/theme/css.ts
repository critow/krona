/**
 * GENERATED FILE — edit src/theme/krona.css and run `pnpm build:css`.
 *
 * Krona's stylesheet is mirrored here so it can be injected at runtime for
 * zero-config usage, while `krona/styles.css` ships the same bytes for
 * consumers who own their CSS pipeline.
 *
 * Everything is driven by `--krona-*` custom properties: override them on any
 * ancestor to theme the viewer without touching a selector.
 */
export const KRONA_CSS = `:where(.krona) {
  /* Layout */
  --krona-line-height: 20px;
  --krona-font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  --krona-font-size: 12.5px;
  --krona-gutter-width: 3.5rem;
  --krona-padding-inline: 0.75rem;

  /* Surfaces */
  --krona-bg: #ffffff;
  --krona-bg-gutter: #f6f8fa;
  --krona-bg-hover: #f0f3f6;
  --krona-border: #d8dee4;
  --krona-fg: #1f2328;
  --krona-fg-muted: #59636e;

  /* Tokens */
  --krona-token-key: #0550ae;
  --krona-token-string: #0a7d33;
  --krona-token-number: #953800;
  --krona-token-boolean: #8250df;
  --krona-token-null: #8250df;
  --krona-token-comment: #59636e;
  --krona-token-punctuation: #59636e;
  --krona-token-section: #6639ba;

  /* Diff */
  --krona-added-bg: #e6ffec;
  --krona-added-strong-bg: #abf2bc;
  --krona-removed-bg: #ffebe9;
  --krona-removed-strong-bg: #ffc1bd;
  --krona-spacer-bg: #f6f8fa;
  --krona-added-marker: #1a7f37;
  --krona-removed-marker: #cf222e;

  /* Warnings */
  --krona-unsafe-bg: #cf222e;
  --krona-unsafe-fg: #ffffff;
}

:where(.krona[data-theme='dark']) {
  --krona-bg: #0d1117;
  --krona-bg-gutter: #010409;
  --krona-bg-hover: #161b22;
  --krona-border: #30363d;
  --krona-fg: #e6edf3;
  --krona-fg-muted: #8d96a0;

  --krona-token-key: #79c0ff;
  --krona-token-string: #7ee787;
  --krona-token-number: #ffa657;
  --krona-token-boolean: #d2a8ff;
  --krona-token-null: #d2a8ff;
  --krona-token-comment: #8d96a0;
  --krona-token-punctuation: #8d96a0;
  --krona-token-section: #d2a8ff;

  --krona-added-bg: #12261e;
  --krona-added-strong-bg: #1f6f36;
  --krona-removed-bg: #25171c;
  --krona-removed-strong-bg: #86181d;
  --krona-spacer-bg: #0b0f14;
  --krona-added-marker: #3fb950;
  --krona-removed-marker: #f85149;

  --krona-unsafe-bg: #f85149;
  --krona-unsafe-fg: #0d1117;
}

@media (prefers-color-scheme: dark) {
  :where(.krona[data-theme='auto']) {
    --krona-bg: #0d1117;
    --krona-bg-gutter: #010409;
    --krona-bg-hover: #161b22;
    --krona-border: #30363d;
    --krona-fg: #e6edf3;
    --krona-fg-muted: #8d96a0;

    --krona-token-key: #79c0ff;
    --krona-token-string: #7ee787;
    --krona-token-number: #ffa657;
    --krona-token-boolean: #d2a8ff;
    --krona-token-null: #d2a8ff;
    --krona-token-comment: #8d96a0;
    --krona-token-punctuation: #8d96a0;
    --krona-token-section: #d2a8ff;

    --krona-added-bg: #12261e;
    --krona-added-strong-bg: #1f6f36;
    --krona-removed-bg: #25171c;
    --krona-removed-strong-bg: #86181d;
    --krona-spacer-bg: #0b0f14;
    --krona-added-marker: #3fb950;
    --krona-removed-marker: #f85149;

    --krona-unsafe-bg: #f85149;
    --krona-unsafe-fg: #0d1117;
  }
}

.krona {
  color: var(--krona-fg);
  background: var(--krona-bg);
  font-family: var(--krona-font-family);
  font-size: var(--krona-font-size);
  line-height: var(--krona-line-height);
  border: 1px solid var(--krona-border);
  border-radius: 6px;
  overflow: hidden;
  text-align: left;
  display: flex;
  flex-direction: column;
  height: var(--krona-height, 24rem);
}

.krona-viewer,
.krona-diff {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.krona *,
.krona *::before,
.krona *::after {
  box-sizing: border-box;
}

.krona-scroll {
  overflow: auto;
  position: relative;
  /* Containment keeps scrolling off the rest of the page's layout work. */
  contain: strict;
  height: 100%;
  min-height: 0;
}

.krona-canvas {
  display: flex;
  align-items: flex-start;
  position: relative;
  min-width: min-content;
}

.krona-column {
  position: relative;
  flex: 0 0 auto;
}

.krona-column--lines {
  flex: 1 1 auto;
  min-width: max-content;
}

.krona-row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--krona-line-height);
  /* Block, not flex: a flex container drops leading whitespace in its anonymous
     items, which would silently strip every line's indentation. */
  display: block;
  white-space: pre;
  /* Rows are uniform and off-screen most of the time; skip their rendering work. */
  contain: layout paint style;
}

/* Gutter ------------------------------------------------------------------ */

.krona-gutter {
  position: sticky;
  left: 0;
  z-index: 2;
  width: var(--krona-gutter-width);
  background: var(--krona-bg-gutter);
  border-right: 1px solid var(--krona-border);
  user-select: none;
}

.krona-gutter .krona-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  padding-inline: 0.375rem;
  color: var(--krona-fg-muted);
}

.krona-gutter-number {
  font-variant-numeric: tabular-nums;
  min-width: 1.5rem;
  text-align: right;
}

.krona-fold-toggle {
  all: unset;
  cursor: pointer;
  width: 1rem;
  height: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  color: var(--krona-fg-muted);
  flex: 0 0 auto;
}

.krona-fold-toggle:hover {
  background: var(--krona-bg-hover);
  color: var(--krona-fg);
}

.krona-fold-toggle:focus-visible {
  outline: 2px solid var(--krona-token-key);
  outline-offset: -1px;
}

.krona-fold-toggle svg {
  width: 0.75rem;
  height: 0.75rem;
  transition: transform 80ms linear;
}

.krona-fold-toggle[aria-expanded='false'] svg {
  transform: rotate(-90deg);
}

@media (prefers-reduced-motion: reduce) {
  .krona-fold-toggle svg {
    transition: none;
  }
}

.krona-fold-spacer {
  width: 1rem;
  flex: 0 0 auto;
}

/* Lines ------------------------------------------------------------------- */

.krona-lines .krona-row {
  padding-inline: var(--krona-padding-inline);
  width: max-content;
  min-width: 100%;
}

.krona-token--key {
  color: var(--krona-token-key);
}
.krona-token--string {
  color: var(--krona-token-string);
}
.krona-token--number {
  color: var(--krona-token-number);
}
.krona-token--boolean {
  color: var(--krona-token-boolean);
}
.krona-token--null {
  color: var(--krona-token-null);
}
.krona-token--comment {
  color: var(--krona-token-comment);
  font-style: italic;
}
.krona-token--punctuation {
  color: var(--krona-token-punctuation);
}
.krona-token--section {
  color: var(--krona-token-section);
  font-weight: 600;
}

.krona-fold-placeholder {
  margin-left: 0.4em;
  padding: 0 0.4em;
  border-radius: 3px;
  background: var(--krona-bg-hover);
  color: var(--krona-fg-muted);
  cursor: pointer;
  border: 1px solid var(--krona-border);
  font: inherit;
  line-height: 1.2;
}

.krona-unsafe {
  background: var(--krona-unsafe-bg);
  color: var(--krona-unsafe-fg);
  border-radius: 2px;
  padding: 0 2px;
  font-size: 0.85em;
}

/* Diff -------------------------------------------------------------------- */

.krona-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

.krona-panels--with-minimap {
  grid-template-columns: 1fr 12px 1fr;
}

.krona-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--krona-border);
}

.krona-panel:last-child {
  border-right: none;
}

.krona-row--added {
  background: var(--krona-added-bg);
}
.krona-row--removed {
  background: var(--krona-removed-bg);
}
.krona-row--changed {
  background: var(--krona-added-bg);
}
.krona-panel--left .krona-row--changed {
  background: var(--krona-removed-bg);
}
.krona-row--spacer {
  background: var(--krona-spacer-bg);
}

.krona-intraline {
  border-radius: 2px;
}

.krona-panel--left .krona-intraline {
  background: var(--krona-removed-strong-bg);
}

.krona-panel--right .krona-intraline {
  background: var(--krona-added-strong-bg);
}

.krona-gutter .krona-row--added .krona-gutter-marker {
  color: var(--krona-added-marker);
}

.krona-gutter .krona-row--removed .krona-gutter-marker {
  color: var(--krona-removed-marker);
}

.krona-expand-bar {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: var(--krona-line-height);
  padding-inline: var(--krona-padding-inline);
  background: var(--krona-bg-gutter);
  color: var(--krona-fg-muted);
  border-block: 1px solid var(--krona-border);
  cursor: pointer;
}

.krona-expand-bar:hover {
  background: var(--krona-bg-hover);
}

.krona-expand-bar:focus-visible {
  outline: 2px solid var(--krona-token-key);
  outline-offset: -2px;
}

.krona-expand-actions {
  display: flex;
  gap: 0.25rem;
}

.krona-expand-action {
  all: unset;
  cursor: pointer;
  padding: 0 0.25rem;
  border-radius: 3px;
}

.krona-expand-action:hover {
  background: var(--krona-bg-hover);
  color: var(--krona-fg);
}

.krona-expand-action:focus-visible {
  outline: 2px solid var(--krona-token-key);
  outline-offset: -1px;
}

/* Toolbar ----------------------------------------------------------------- */

.krona-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem var(--krona-padding-inline);
  background: var(--krona-bg-gutter);
  border-bottom: 1px solid var(--krona-border);
  color: var(--krona-fg-muted);
  flex: 0 0 auto;
}

.krona-toolbar button {
  all: unset;
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  border: 1px solid var(--krona-border);
  color: var(--krona-fg);
}

.krona-toolbar button:hover {
  background: var(--krona-bg-hover);
}

.krona-toolbar button:focus-visible {
  outline: 2px solid var(--krona-token-key);
  outline-offset: 1px;
}

.krona-stat--added {
  color: var(--krona-added-marker);
}

.krona-stat--removed {
  color: var(--krona-removed-marker);
}

/* Minimap ----------------------------------------------------------------- */

.krona-minimap {
  position: relative;
  width: 12px;
  background: var(--krona-bg-gutter);
  border-inline: 1px solid var(--krona-border);
  cursor: pointer;
  align-self: stretch;
}

.krona-minimap-mark {
  position: absolute;
  left: 1px;
  right: 1px;
  min-height: 2px;
  border-radius: 1px;
}

.krona-minimap-mark--added {
  background: var(--krona-added-marker);
}

.krona-minimap-mark--removed {
  background: var(--krona-removed-marker);
}

.krona-minimap-mark--changed {
  background: var(--krona-token-number);
}

/* Diagnostics ------------------------------------------------------------- */

.krona-diagnostics {
  padding: 0.375rem var(--krona-padding-inline);
  border-bottom: 1px solid var(--krona-border);
  background: var(--krona-removed-bg);
  color: var(--krona-fg);
  font-family: system-ui, sans-serif;
  font-size: 12px;
}

.krona-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
`
