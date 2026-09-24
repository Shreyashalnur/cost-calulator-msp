import { useState } from 'react'
import type { ReactNode } from 'react'
import { fromDisplay, SYMBOL, toDisplay } from '../model/format'
import { useStore } from '../state/context'

function parse(text: string): number | null {
  const cleaned = text.replace(/[,\s₹$%]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function show(v: number, maxDecimals: number, locale: string): string {
  if (!Number.isFinite(v)) return ''
  return v.toLocaleString(locale, { maximumFractionDigits: maxDecimals })
}

export interface NumFieldProps {
  id: string
  label?: ReactNode
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  hint?: ReactNode
  decimals?: number
  locale?: string
  /** Borderless variant for table cells. */
  cell?: boolean
  ariaLabel?: string
  disabled?: boolean
}

export function NumField(p: NumFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? show(p.value, p.decimals ?? 2, p.locale ?? 'en-US')
  const commit = (raw: string) => {
    setDraft(raw)
    const n = parse(raw)
    if (n === null) return
    let v = n
    if (p.min !== undefined) v = Math.max(p.min, v)
    if (p.max !== undefined) v = Math.min(p.max, v)
    p.onChange(v)
  }
  const input = (
    <span className={p.cell ? 'field-box cell' : 'field-box'}>
      {p.prefix && <span className="affix">{p.prefix}</span>}
      <input
        id={p.id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        disabled={p.disabled}
        aria-label={p.ariaLabel}
        onChange={(e) => commit(e.target.value)}
        onFocus={(e) => {
          setDraft(text.replace(/,/g, ''))
          e.target.select()
        }}
        onBlur={() => setDraft(null)}
      />
      {p.suffix && <span className="affix">{p.suffix}</span>}
    </span>
  )
  if (p.cell) return input
  return (
    <div className="field">
      {p.label && (
        <label className="field-label" htmlFor={p.id}>
          {p.label}
        </label>
      )}
      {input}
      {p.hint && <span className="field-hint">{p.hint}</span>}
    </div>
  )
}

/** A number field for money: stored in USD, edited in the display currency. */
export function MoneyField(p: Omit<NumFieldProps, 'prefix' | 'locale'>) {
  const { money } = useStore()
  const display = toDisplay(p.value, money)
  return (
    <NumField
      {...p}
      prefix={SYMBOL[money.currency]}
      locale={money.currency === 'INR' ? 'en-IN' : 'en-US'}
      decimals={p.decimals ?? (Math.abs(display) >= 100 ? 0 : 2)}
      value={display}
      onChange={(v) => p.onChange(fromDisplay(v, money))}
    />
  )
}

export interface SegmentedProps<T extends string> {
  id: string
  label?: ReactNode
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  hint?: ReactNode
}

export function Segmented<T extends string>(p: SegmentedProps<T>) {
  const group = (
    <div className="segmented" role="radiogroup" aria-labelledby={p.label ? `${p.id}-label` : undefined}>
      {p.options.map((o) => (
        <button
          key={o.value}
          id={`${p.id}-${o.value}`}
          type="button"
          role="radio"
          aria-checked={o.value === p.value}
          className={o.value === p.value ? 'on' : undefined}
          onClick={() => p.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
  if (!p.label) return group
  return (
    <div className="field">
      <span className="field-label" id={`${p.id}-label`}>
        {p.label}
      </span>
      {group}
      {p.hint && <span className="field-hint">{p.hint}</span>}
    </div>
  )
}

export function Switch(p: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  ariaLabel?: string
}) {
  return (
    <label className="switch" htmlFor={p.id}>
      <input
        id={p.id}
        type="checkbox"
        role="switch"
        checked={p.checked}
        aria-label={p.ariaLabel}
        onChange={(e) => p.onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      {p.label && <span className="switch-label">{p.label}</span>}
    </label>
  )
}

export function Slider(p: {
  id: string
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
  hint?: ReactNode
}) {
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={p.id}>{p.label}</label>
        <output htmlFor={p.id}>{p.display}</output>
      </div>
      <input
        id={p.id}
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
      {p.hint && <span className="field-hint">{p.hint}</span>}
    </div>
  )
}

export function Card(p: {
  title?: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={p.className ? `card ${p.className}` : 'card'} id={p.id}>
      {(p.title || p.actions) && (
        <header className="card-head">
          <div>
            {p.title && <h2>{p.title}</h2>}
            {p.sub && <p className="card-sub">{p.sub}</p>}
          </div>
          {p.actions && <div className="card-actions">{p.actions}</div>}
        </header>
      )}
      {p.children}
    </section>
  )
}

/** A thin horizontal meter. `value` is 0..1. */
export function Meter(p: { value: number; tone?: 'accent' | 'capex' | 'opex' | 'good' | 'warn' | 'bad' | 'muted'; label?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(p.value) ? p.value : 0))
  return (
    <span className={`meter tone-${p.tone ?? 'accent'}`} role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={p.label}>
      <span style={{ width: `${v * 100}%` }} />
    </span>
  )
}

export function Pill(p: { tone: 'good' | 'warn' | 'bad' | 'capex' | 'opex' | 'muted' | 'accent'; children: ReactNode }) {
  return <span className={`pill tone-${p.tone}`}>{p.children}</span>
}
