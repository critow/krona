import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * A deliberately small set of controls for the demo page.
 *
 * Written here rather than pulled from a component library on purpose: the
 * playground is the shop window for a package that ships three runtime
 * dependencies, and it would read badly if the demo of it needed thirty. Every
 * piece below is a button, a div and a CSS custom property.
 */

export function Button({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className="ui-button" {...rest}>
      {children}
    </button>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** A radio group that reads as one control: mode switches, theme switches. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <fieldset className="ui-segment">
      <legend>{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}

export function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="ui-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-track" aria-hidden="true" />
      {children}
    </button>
  )
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className ? `ui-panel ${className}` : 'ui-panel'}>
      {title || actions ? (
        <header className="ui-panel-head">
          {title ? <h2 className="ui-panel-title">{title}</h2> : null}
          {actions ? <div className="ui-spacer">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="ui-badge">{children}</span>
}

/** One token of the generated snippet. */
export interface CodeToken {
  text: string
  kind?: 'tag' | 'attr' | 'str' | 'punct'
}

/**
 * Renders a pre-tokenized snippet. Tokens are produced by the caller, never
 * parsed out of a string here — the demo of a library that refuses `innerHTML`
 * should not reach for it either.
 */
export function CodeBlock({ tokens }: { tokens: readonly CodeToken[] }) {
  return (
    <pre className="ui-code">
      <code>
        {tokens.map((token, index) => (
          <span
            // Snippet tokens have no identity beyond their position.
            key={`${index}-${token.text}`}
            className={token.kind ?? undefined}
          >
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  )
}
