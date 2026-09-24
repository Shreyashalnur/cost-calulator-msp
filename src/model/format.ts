import type { Currency } from './types'

export interface MoneyCtx {
  currency: Currency
  fx: number
}

export const SYMBOL: Record<Currency, string> = { USD: '$', INR: '₹' }

export function toDisplay(usd: number, ctx: MoneyCtx): number {
  return ctx.currency === 'INR' ? usd * ctx.fx : usd
}

export function fromDisplay(value: number, ctx: MoneyCtx): number {
  return ctx.currency === 'INR' ? value / (ctx.fx || 1) : value
}

function locale(ctx: MoneyCtx): string {
  return ctx.currency === 'INR' ? 'en-IN' : 'en-US'
}

export interface MoneyOpts {
  decimals?: number
  compact?: boolean
}

/** Formats a USD amount in the display currency. INR uses lakh/crore grouping. */
export function money(usd: number | null | undefined, ctx: MoneyCtx, opts: MoneyOpts = {}): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return '—'
  const v = toDisplay(usd, ctx)
  const sign = v < 0 ? '−' : ''
  const a = Math.abs(v)
  const sym = SYMBOL[ctx.currency]
  if (opts.compact) {
    if (ctx.currency === 'INR') {
      if (a >= 1e7) return `${sign}${sym}${trim(a / 1e7)} Cr`
      if (a >= 1e5) return `${sign}${sym}${trim(a / 1e5)} L`
    } else {
      if (a >= 1e6) return `${sign}${sym}${trim(a / 1e6)}M`
      if (a >= 1e4) return `${sign}${sym}${trim(a / 1e3)}K`
    }
  }
  const decimals = opts.decimals ?? (a >= 100 ? 0 : a >= 1 ? 2 : 3)
  return `${sign}${sym}${a.toLocaleString(locale(ctx), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function trim(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })
}

export function num(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function pct(fraction: number | null | undefined, decimals = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(decimals)}%`
}

/** GiB shown as GB or TB, the way tenants read storage. */
export function storage(gib: number): string {
  if (!Number.isFinite(gib)) return '—'
  return gib >= 1024 ? `${num(gib / 1024, 1)} TB` : `${num(gib)} GB`
}
