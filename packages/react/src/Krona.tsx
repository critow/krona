import { KronaRoot } from './KronaRoot'
import { Diagnostics } from './parts/Diagnostics'
import { Gutter } from './parts/Gutter'
import { Lines } from './parts/Lines'
import { Toolbar } from './parts/Toolbar'
import { KronaViewer } from './viewer/Viewer'

/**
 * Krona — a collapsible tree view and side-by-side diff for configuration files.
 *
 * `<Krona>` is the configuration root; a mode (`Krona.Viewer` or `Krona.Diff`)
 * goes inside it. Each mode renders a default layout when given no children,
 * and can be taken apart into the same public parts when you need your own.
 *
 * @example Simple viewer
 * ```tsx
 * <Krona format="yaml" theme="dark">
 *   <Krona.Viewer source={text} defaultCollapsedDepth={2} />
 * </Krona>
 * ```
 *
 * @example Simple diff
 * ```tsx
 * <Krona format="json">
 *   <Krona.Diff left={before} right={after} collapseUnchanged />
 * </Krona>
 * ```
 *
 * @example Custom diff layout
 * ```tsx
 * <Krona.Diff left={before} right={after}>
 *   <Krona.Panel side="left">
 *     <Krona.Gutter />
 *     <Krona.Lines />
 *   </Krona.Panel>
 *   <Krona.Minimap />
 *   <Krona.Panel side="right">
 *     <Krona.Gutter />
 *     <Krona.Lines />
 *   </Krona.Panel>
 * </Krona.Diff>
 * ```
 */
export const Krona = Object.assign(KronaRoot, {
  Viewer: KronaViewer,
  Gutter,
  Lines,
  Toolbar,
  Diagnostics,
})
