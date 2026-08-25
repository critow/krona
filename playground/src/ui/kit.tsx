import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { createContext, useContext, useId } from 'react'

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

/** A labelled row in the options panel. Label and control share one baseline. */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <div className="ui-field">
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="ui-field-control">
        <FieldIdContext.Provider value={id}>{children}</FieldIdContext.Provider>
      </div>
    </div>
  )
}

const FieldIdContext = createContext<string | undefined>(undefined)

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
}) {
  const id = useContext(FieldIdContext)
  return (
    <select
      id={id}
      className="ui-select"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function NumberField({
  value,
  onChange,
  min = 0,
  max = 999,
  placeholder,
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  placeholder?: string
}) {
  const id = useContext(FieldIdContext)
  return (
    <input
      id={id}
      className="ui-number"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value ?? ''}
      placeholder={placeholder ?? ''}
      onChange={(event) => {
        const next = event.target.value
        onChange(next === '' ? undefined : Math.min(max, Math.max(min, Number(next))))
      }}
    />
  )
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="ui-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
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
