import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { money, toDisplay } from '../model/format'
import { useStore } from '../state/context'

const axis = {
  stroke: 'var(--line-strong)',
  tick: { fill: 'var(--ink-3)', fontSize: 12 },
  tickLine: false,
}

interface TipRow {
  name: string
  value: string
  color: string
}

function Tip(p: { active?: boolean; label?: string | number; rows: TipRow[]; title: string }) {
  if (!p.active || p.rows.length === 0) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{p.title}</div>
      {p.rows.map((r) => (
        <div key={r.name} className="chart-tip-row">
          <span className="swatch" style={{ background: r.color }} />
          <span>{r.name}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  )
}

/** Cost per VM as occupancy rises, against the list price. */
export function CostCurveChart() {
  const { results, model, money: ctx } = useStore()
  const price = results.unit.pricePerVm
  const data = results.curve
    .filter((d) => d.occupancyPct >= 10)
    .map((d) => ({ occ: d.occupancyPct, cost: toDisplay(d.costPerVm, ctx) }))
  if (data.length === 0 || price === null) {
    return <p className="empty">No sellable capacity. Check the cluster roles and node counts.</p>
  }
  const back = (v: number) => v / (ctx.currency === 'INR' ? ctx.fx : 1)
  const priceD = toDisplay(price, ctx)
  const yMax = niceCeil(priceD * 2.6)
  const target = model.capacity.targetOccupancyPct
  const be = results.vms.breakEvenOccupancyPct
  return (
    <div className="chart" role="img" aria-label="Line chart of monthly cost per VM falling as occupancy rises, with the price line.">
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          {be !== null && be > 10 && be < 100 && (
            <ReferenceArea x1={10} x2={be} y1={0} y2={yMax} fill="var(--bad-soft)" fillOpacity={0.7} ifOverflow="hidden" />
          )}
          <XAxis
            dataKey="occ"
            type="number"
            domain={[10, 100]}
            ticks={[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            tickFormatter={(v: number) => `${v}%`}
            {...axis}
          />
          <YAxis
            domain={[0, yMax]}
            allowDataOverflow
            width={70}
            tickFormatter={(v: number) => money(back(v), ctx, { compact: true, decimals: 0 })}
            {...axis}
          />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)' }}
            content={({ active, payload, label }) => (
              <Tip
                active={active}
                title={`${label}% occupancy`}
                rows={
                  payload?.length
                    ? [
                        { name: 'Cost per VM', value: money(back(Number(payload[0].value)), ctx), color: 'var(--ink)' },
                        { name: 'Price per VM', value: money(price, ctx), color: 'var(--good)' },
                      ]
                    : []
                }
              />
            )}
          />
          <ReferenceLine
            y={priceD}
            stroke="var(--good)"
            strokeWidth={2}
            strokeDasharray="6 4"
            label={{ value: `Price ${money(price, ctx)}`, position: 'insideTopRight', fill: 'var(--good)', fontSize: 12 }}
          />
          <ReferenceLine
            x={target}
            stroke="var(--accent)"
            strokeWidth={1.5}
            label={{ value: `Target ${target}%`, position: 'insideTopLeft', fill: 'var(--accent)', fontSize: 12 }}
          />
          <Line type="monotone" dataKey="cost" stroke="var(--ink)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Monthly revenue against monthly cost across the term. */
export function RevenueCostChart() {
  const { results, money: ctx } = useStore()
  const data = results.cashflow.months
    .filter((m) => m.month > 0)
    .map((m) => ({
      month: m.month,
      revenue: toDisplay(m.revenue, ctx),
      cost: toDisplay(m.opex + m.capitalCharge, ctx),
    }))
  const back = (v: number) => v / (ctx.currency === 'INR' ? ctx.fx : 1)
  return (
    <div className="chart" role="img" aria-label="Monthly revenue rising through the ramp against a flat monthly cost line.">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="month" type="number" domain={[1, data.length]} ticks={yearTicks(data.length)} tickFormatter={(v: number) => `M${v}`} {...axis} />
          <YAxis width={70} tickFormatter={(v: number) => money(back(v), ctx, { compact: true, decimals: 0 })} {...axis} />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)' }}
            content={({ active, payload, label }) => (
              <Tip
                active={active}
                title={`Month ${label}`}
                rows={(payload ?? []).map((p) => ({
                  name: p.dataKey === 'revenue' ? 'Revenue' : 'Cost incl. capital charge',
                  value: money(back(Number(p.value)), ctx),
                  color: p.dataKey === 'revenue' ? 'var(--good)' : 'var(--ink)',
                }))}
              />
            )}
          />
          <Line type="monotone" dataKey="cost" stroke="var(--ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="revenue" stroke="var(--good)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Cumulative cash position, starting with the capex outlay. */
export function CumulativeCashChart() {
  const { results, money: ctx } = useStore()
  const data = results.cashflow.months.map((m) => ({ month: m.month, cum: toDisplay(m.cumulativeCash, ctx) }))
  const back = (v: number) => v / (ctx.currency === 'INR' ? ctx.fx : 1)
  const payback = results.cashflow.paybackMonth
  return (
    <div className="chart" role="img" aria-label="Cumulative cash position starting below zero after the capex outlay and climbing through the term.">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="month" type="number" domain={[0, data.length - 1]} ticks={[0, ...yearTicks(data.length - 1)]} tickFormatter={(v: number) => `M${v}`} {...axis} />
          <YAxis width={70} tickFormatter={(v: number) => money(back(v), ctx, { compact: true, decimals: 0 })} {...axis} />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)' }}
            content={({ active, payload, label }) => (
              <Tip
                active={active}
                title={`Month ${label}`}
                rows={(payload ?? []).map((p) => ({
                  name: 'Cumulative cash',
                  value: money(back(Number(p.value)), ctx),
                  color: 'var(--accent)',
                }))}
              />
            )}
          />
          <ReferenceLine y={0} stroke="var(--ink-3)" />
          {payback !== null && (
            <ReferenceLine
              x={payback}
              stroke="var(--good)"
              strokeDasharray="6 4"
              label={{ value: `Payback M${payback}`, position: 'insideTopLeft', fill: 'var(--good)', fontSize: 12 }}
            />
          )}
          <Area type="monotone" dataKey="cum" stroke="var(--accent)" strokeWidth={2} fill="url(#cumFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function yearTicks(months: number): number[] {
  const t: number[] = []
  for (let m = 12; m <= months; m += 12) t.push(m)
  return t
}

function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * mag
}
