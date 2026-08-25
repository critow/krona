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
  --krona-font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
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
  --krona-chevron: #57606a;
  --krona-chevron-hover: #0550ae;
  --krona-scrollbar: #c2c9d1;
  --krona-match-bg: #fff3c4;
  --krona-match-current-bg: #ffc86b;

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
  --krona-tooltip-bg: #1f2328;
  --krona-tooltip-fg: #ffffff;
}

:where(.krona[data-theme="dark"]) {
  --krona-bg: #0d1117;
  --krona-bg-gutter: #010409;
  --krona-bg-hover: #161b22;
  --krona-border: #30363d;
  --krona-fg: #e6edf3;
  --krona-fg-muted: #8d96a0;
  --krona-chevron: #a8b3bf;
  --krona-chevron-hover: #79c0ff;
  --krona-scrollbar: #3d444d;
  --krona-match-bg: #4a3a12;
  --krona-match-current-bg: #9e6a12;

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
  --krona-tooltip-bg: #e6edf3;
  --krona-tooltip-fg: #0d1117;
}

@media (prefers-color-scheme: dark) {
  :where(.krona[data-theme="auto"]) {
    --krona-bg: #0d1117;
    --krona-bg-gutter: #010409;
    --krona-bg-hover: #161b22;
    --krona-border: #30363d;
    --krona-fg: #e6edf3;
    --krona-fg-muted: #8d96a0;
    --krona-chevron: #a8b3bf;
    --krona-chevron-hover: #79c0ff;
    --krona-scrollbar: #3d444d;
    --krona-match-bg: #4a3a12;
    --krona-match-current-bg: #9e6a12;

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
    --krona-tooltip-bg: #e6edf3;
    --krona-tooltip-fg: #0d1117;
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

.krona-width-strut {
  height: 0;
  pointer-events: none;
}

/* Editing
   ------------------------------------------------------------------------- */

.krona-row-actions {
  /* Hidden rather than transparent: an invisible control that still takes a
     click is worse than no control, and a row is a small target. */
  display: none;
  margin-inline-start: 0.75rem;
  vertical-align: middle;
  white-space: nowrap;
}

.krona-row--actionable:hover .krona-row-actions,
.krona-row-actions:focus-within {
  display: inline-flex;
  gap: 0.125rem;
}

/* Rows contain their layout, which makes each one its own stacking context, so
   a tooltip's z-index only ever ranks it against the rest of its own row —
   later rows still paint over it. The row itself has to rise instead, but only
   just: the gutter is sticky at 2, and a row that outranked it would slide over
   the line numbers the moment the panel scrolled sideways. */
.krona-row--actionable:hover,
.krona-row--actionable:focus-within,
.krona-row--actionable:has(.krona-action--confirmed) {
  z-index: 1;
}

/* Nothing hovers on a touch screen, so there the actions simply stay out. */
@media (hover: none) {
  .krona-row--actionable .krona-row-actions {
    display: inline-flex;
    gap: 0.125rem;
  }
}

.krona-row-actions button,
.krona-editor-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 1px solid var(--krona-border);
  border-radius: 4px;
  background: var(--krona-bg);
  color: var(--krona-fg-muted);
  cursor: pointer;
}

.krona-row-actions button:hover,
.krona-editor-actions button:hover {
  background: var(--krona-bg-hover);
  color: var(--krona-fg);
}

.krona-row-actions .krona-action--danger:hover {
  color: var(--krona-removed-marker);
  border-color: currentColor;
}

.krona-value {
  /* Stripped back to the text it wraps: the element is a button so a value can
     be reached and opened from the keyboard, not so it can look like one. */
  display: inline;
  font: inherit;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  border-radius: 3px;
  cursor: text;
}

.krona-row--actionable .krona-value:hover {
  background: var(--krona-bg-hover);
  outline: 1px solid var(--krona-border);
}

.krona-editor-input,
.krona-editor-area {
  font: inherit;
  color: var(--krona-fg);
  background: var(--krona-bg);
  border: 1px solid var(--krona-chevron-hover);
  border-radius: 3px;
  padding: 0 0.125rem;
  vertical-align: baseline;
}

/* Tooltips
   -------------------------------------------------------------------------
   Built from a data-tip attribute and a pseudo-element rather than a native
   title: the native one waits about a second, cannot be themed, and cannot be
   shown on demand, which is exactly what a copy confirmation needs. The
   attr() function renders the attribute as text, never as markup. */

.krona-sr-only {
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

[data-tip] {
  position: relative;
}

[data-tip]::after {
  content: attr(data-tip);
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: var(--krona-tooltip-bg);
  color: var(--krona-tooltip-fg);
  font-size: 0.85em;
  line-height: 1.5;
  white-space: nowrap;
  /* A path in a deeply nested file can be longer than the panel; the bubble
     tells you which one you are about to copy, not the whole of it. */
  max-width: 48ch;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  opacity: 0;
  /* Kept out of the tree until it is wanted, so it never widens a row. */
  visibility: hidden;
  transition: opacity 120ms ease 250ms;
}

[data-tip]:hover::after,
[data-tip]:focus-visible::after,
.krona-action--confirmed::after {
  opacity: 1;
  visibility: visible;
}

/* A confirmation has already been asked for, so it appears at once. */
.krona-action--confirmed::after {
  transition-delay: 0ms;
}

.krona-action--confirmed {
  color: var(--krona-added-marker);
  border-color: currentColor;
}

.krona-editor-actions {
  display: inline-flex;
  gap: 0.125rem;
  margin-inline-start: 0.375rem;
  vertical-align: middle;
}

.krona-row-overlay {
  position: absolute;
  top: 0;
  left: 0;
  /* Above the rows it covers: they come later in the DOM and would paint over
     an editor that only relied on source order. */
  z-index: 3;
  display: flex;
  align-items: flex-start;
  padding-inline: var(--krona-padding-inline);
}

.krona-editor-block {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.25rem;
}

.krona-editor-area {
  min-width: 32ch;
  height: 100%;
  resize: none;
  white-space: pre;
  overflow: auto;
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
  /* Rows are uniform; skip the layout and style work they cannot affect outside
     themselves. Not paint: that clips descendants to the row box, and a
     tooltip on a 20px row has nowhere to go inside one. Rows are virtualized,
     so paint containment was saving work on a handful of elements anyway. */
  contain: layout style;
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

/* The control is the whole gutter cell, not just the icon: a 16px chevron
   wedged between a line number and the code reads as punctuation rather than
   as something to click, and nothing else competes for a click in a read-only
   gutter. */
.krona-fold-toggle {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: var(--krona-fg-muted);
  cursor: pointer;
  text-align: inherit;
}

.krona-fold-toggle:hover {
  background: var(--krona-bg-hover);
  color: var(--krona-fg);
}

.krona-fold-toggle:hover .krona-fold-chevron {
  color: var(--krona-chevron-hover);
}

.krona-fold-toggle:focus-visible {
  outline: 2px solid var(--krona-token-key);
  outline-offset: -2px;
}

.krona-fold-chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex: 0 0 auto;
  color: var(--krona-chevron);
  transition:
    transform 80ms linear,
    color 80ms linear;
}

.krona-fold-toggle[aria-expanded="false"] .krona-fold-chevron {
  transform: rotate(-90deg);
}

@media (prefers-reduced-motion: reduce) {
  .krona-fold-chevron {
    transition: none;
  }
}

.krona-fold-spacer {
  width: 0.875rem;
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

/* One column carries both versions, so it takes the whole width — including on
   a screen wide enough for two, where the reader asked for the unified view. */
.krona-panels:has(.krona-panel--unified) {
  grid-template-columns: minmax(0, 1fr);
}

.krona-panels--with-minimap,
/* Asked of the DOM rather than counted in the layout code: a custom layout can
   put the minimap inside a component of its own, and then no count of the
   diff's children knows the track is needed. Without the track the minimap
   takes a panel's column and the second panel wraps onto its own row. */
.krona-panels:has(.krona-minimap) {
  grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
}

/* Narrow layout
   -------------------------------------------------------------------------
   Driven by the root's own measured width rather than a media query, so a
   component in a sidebar is treated like one on a phone. */

.krona[data-narrow="true"] {
  /* Narrower, but not below the 44px a finger needs: the whole gutter cell is
     the fold control, and shrinking it to save width would take the target with
     it — on the very devices that have no pointer to aim with. */
  --krona-gutter-width: 2.75rem;
  --krona-padding-inline: 0.5rem;
}

/* One panel, one column: the second track would otherwise hold the width of a
   panel that is not being rendered. */
.krona[data-narrow="true"] .krona-panels {
  grid-template-columns: minmax(0, 1fr);
}

/* A unified column needs the marker as well as the number, which is exactly
   what the narrowed gutter has no room for. Narrow diffs are unified by
   default, so this is the common case rather than the exception. */
.krona[data-narrow="true"] .krona-panel--unified .krona-gutter {
  --krona-gutter-width: 3.5rem;
}

.krona-side-switch {
  display: inline-flex;
  gap: 0.125rem;
  /* A fieldset carries a border and padding of its own; only its semantics are
     wanted here. */
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: auto;
}

.krona-side-switch button {
  all: unset;
  cursor: pointer;
  white-space: nowrap;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  border: 1px solid var(--krona-border);
  color: var(--krona-fg-muted);
}

.krona-side-switch button:focus-visible {
  outline: 2px solid var(--krona-token-key);
  outline-offset: 1px;
}

.krona-side-switch button[aria-pressed="true"] {
  /* Which version is on screen is the one thing this control has to say, so it
     says it with colour rather than a shade of border. */
  background: var(--krona-bg-hover);
  color: var(--krona-chevron-hover);
  border-color: currentcolor;
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

.krona-panel--unified {
  border-right: none;
}

/* A wheel over one panel scrolls both, and the browser then flashes a scrollbar
   on the panel nobody is pointing at — two bars moving for one gesture. Paint
   the bar only on the pane the reader is over, or has focus in. Only the colour
   changes, so the track keeps whatever width the platform gives it and the two
   panels stay equal as one appears. Left alone where there is no pointer to
   hover with: a touch device already shows its overlay bar on the pane it
   scrolled, which is the behaviour being asked for. */
@media (hover: hover) {
  .krona-panel > .krona-scroll {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }

  .krona-panel > .krona-scroll:hover,
  .krona-panel > .krona-scroll:focus-within {
    scrollbar-color: var(--krona-scrollbar) transparent;
  }
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

/* Search
   -------------------------------------------------------------------------
   A match keeps the line's syntax colours and only takes a background: the
   reader is looking for a string, not losing the shape of the line it is in. */

.krona-match {
  background: var(--krona-match-bg);
  border-radius: 2px;
}

.krona-match--current {
  background: var(--krona-match-current-bg);
  /* The one the reader is standing on, told apart from its neighbours by more
     than a shade — several matches can share a line. */
  outline: 1px solid var(--krona-chevron-hover);
}

.krona-search {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem var(--krona-padding-inline);
  border-bottom: 1px solid var(--krona-border);
  background: var(--krona-bg-gutter);
}

.krona-search-input {
  font: inherit;
  color: var(--krona-fg);
  background: var(--krona-bg);
  border: 1px solid var(--krona-border);
  border-radius: 4px;
  padding: 0.125rem 0.375rem;
  min-width: 0;
  /* Grows to a point and then stops: a field the width of a lockfile viewer is
     a field that looks like the document. */
  flex: 1 1 12rem;
  max-width: 24rem;
}

.krona-search-input:focus-visible {
  outline: 2px solid var(--krona-chevron-hover);
  outline-offset: -1px;
}

.krona-search-count {
  color: var(--krona-fg-muted);
  font-size: 0.9em;
  white-space: nowrap;
  /* Reserved so the controls do not shuffle sideways as the count changes. */
  min-width: 6ch;
  text-align: right;
}

.krona-search-step,
.krona-search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  font: inherit;
  border: 1px solid var(--krona-border);
  border-radius: 4px;
  background: var(--krona-bg);
  color: var(--krona-fg-muted);
  cursor: pointer;
}

.krona-search-step:hover:not(:disabled),
.krona-search-toggle:hover {
  background: var(--krona-bg-hover);
  color: var(--krona-fg);
}

.krona-search-step:disabled {
  opacity: 0.5;
  cursor: default;
}

.krona-search-toggle--on {
  color: var(--krona-chevron-hover);
  border-color: currentcolor;
}

.krona-search-arrow {
  width: 12px;
  height: 12px;
}

/* Which shade a word-level highlight takes is a question about the line, and in
   a split diff the panel answers it: everything on the left is the old version.
   A unified column holds both, so there the row answers instead. */
.krona-panel--left .krona-intraline,
.krona-row--removed .krona-intraline {
  background: var(--krona-removed-strong-bg);
}

.krona-panel--right .krona-intraline,
.krona-row--added .krona-intraline {
  background: var(--krona-added-strong-bg);
}

/* Never squeezed out by a narrow gutter: in a unified diff this sign is the
   only thing that says which version a line belongs to. */
.krona-gutter-marker {
  flex: none;
}

.krona-gutter .krona-row--added .krona-gutter-marker {
  color: var(--krona-added-marker);
}

.krona-gutter .krona-row--removed .krona-gutter-marker {
  color: var(--krona-removed-marker);
}

.krona-row--expand {
  background: var(--krona-bg-gutter);
  border-block: 1px solid var(--krona-border);
}

.krona-lines .krona-row--expand {
  padding-inline: 0;
  width: 100%;
  min-width: 100%;
}

.krona-expand-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  padding-inline: var(--krona-padding-inline);
  color: var(--krona-fg-muted);
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
  /* Wraps rather than overflowing: a control pushed off the edge of a phone is
     a control that is not there. Its buttons keep their own words together. */
  flex-wrap: wrap;
  gap: 0.375rem 0.75rem;
  padding: 0.375rem var(--krona-padding-inline);
  background: var(--krona-bg-gutter);
  border-bottom: 1px solid var(--krona-border);
  color: var(--krona-fg-muted);
  flex: 0 0 auto;
}

.krona-toolbar button {
  all: unset;
  cursor: pointer;
  /* A two-word action reads as one control; wrapping turns a toolbar into a
     stack of half-words on a narrow screen. */
  white-space: nowrap;
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
  all: unset;
  box-sizing: border-box;
  display: block;
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
