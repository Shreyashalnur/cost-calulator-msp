import { CumulativeCashChart, RevenueCostChart } from '../components/charts'
import { Card, NumField } from '../components/ui'
import { money, num } from '../model/format'
import { patchSection, useStore } from '../state/context'
import type { ViewProps } from './types'

export function CashflowView({ go }: ViewProps) {
  const { model, results, update, money: ctx } = useStore()
  const cf = results.cashflow
  const p = model.pricing
  const peak = Math.min(...cf.months.map((m) => m.cumulativeCash))
  const years = cf.years.map((y) => ({
    ...y,
    cumulative: cf.months[Math.min(y.year * 12, cf.months.length - 1)].cumulativeCash,
  }))
  return (
    <div className="stack">
      <div className="grid three">
        <Card title="Sales ramp" sub="VMs are sold over time, not on day one.">
          <div className="form-grid">
            <NumField
              id="ramp-start"
              label="Occupancy in month 1"
              value={p.rampStartPct}
              min={0}
              max={100}
              suffix="%"
              decimals={0}
              onChange={(v) => update(patchSection('pricing', { rampStartPct: v }))}
              hint="Anchor customers or migrations ready at launch."
            />
            <NumField
              id="ramp-months"
              label="Months to reach target"
              value={p.rampMonths}
              min={1}
              max={model.finance.termMonths}
              decimals={0}
              suffix="months"
              onChange={(v) => update(patchSection('pricing', { rampMonths: Math.round(v) }))}
              hint={`Linear climb to ${model.capacity.targetOccupancyPct}% occupancy.`}
            />
          </div>
          <p className="muted small">
            Revenue uses the 1-year price of {money(results.unit.pricePerVm, ctx)} per average VM. Term and cost of capital
            are on the{' '}
            <button type="button" className="link" onClick={() => go('capex')}>
              Hardware &amp; capex tab
            </button>
            .
          </p>
        </Card>
        <Card title="Returns" sub={`Over the ${model.finance.termMonths}-month term.`} className="span-2">
          <dl className="facts big">
            <div>
              <dt>Cash payback</dt>
              <dd>{cf.paybackMonth === null ? 'Not in term' : `Month ${cf.paybackMonth}`}</dd>
            </div>
            <div>
              <dt>Peak funding need</dt>
              <dd>{money(-peak, ctx, { compact: true })}</dd>
            </div>
            <div>
              <dt>NPV at {model.finance.costOfCapitalPct}%</dt>
              <dd className={cf.npv < 0 ? 'bad' : 'good'}>{money(cf.npv, ctx, { compact: true })}</dd>
            </div>
            <div>
              <dt>Project IRR</dt>
              <dd>{cf.irrAnnualPct === null ? '—' : `${num(cf.irrAnnualPct, 1)}%`}</dd>
            </div>
            <div>
              <dt>Term revenue</dt>
              <dd>{money(cf.totalRevenue, ctx, { compact: true })}</dd>
            </div>
            <div>
              <dt>Term profit after capital charge</dt>
              <dd className={cf.totalProfit < 0 ? 'bad' : 'good'}>{money(cf.totalProfit, ctx, { compact: true })}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <div className="grid two">
        <Card title="Monthly revenue vs cost" sub="Cost includes the capital charge. Lines cross at P&L break-even.">
          <RevenueCostChart />
          <p className="legend">
            <span className="key line good" /> Revenue <span className="key line ink" /> Cost
          </p>
        </Card>
        <Card title="Cumulative cash" sub="Starts at minus the capex outlay. Crosses zero at payback.">
          <CumulativeCashChart />
        </Card>
      </div>
      <Card title="Year by year">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col" className="num">VMs at year end</th>
                <th scope="col" className="num">Revenue</th>
                <th scope="col" className="num">Opex</th>
                <th scope="col" className="num">Capital charge</th>
                <th scope="col" className="num">Profit</th>
                <th scope="col" className="num">Net cash</th>
                <th scope="col" className="num">Cumulative cash</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Day 0</th>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num bad">{money(-results.totals.totalCapex, ctx)}</td>
                <td className="num bad">{money(-results.totals.totalCapex, ctx)}</td>
              </tr>
              {years.map((y) => (
                <tr key={y.year}>
                  <th scope="row">Year {y.year}</th>
                  <td className="num">{num(y.endVms)}</td>
                  <td className="num">{money(y.revenue, ctx)}</td>
                  <td className="num">{money(y.opex, ctx)}</td>
                  <td className="num">{money(y.capitalCharge, ctx)}</td>
                  <td className={`num ${y.profit < 0 ? 'bad' : 'good'}`}>{money(y.profit, ctx)}</td>
                  <td className="num">{money(y.cash, ctx)}</td>
                  <td className={`num ${y.cumulative < 0 ? 'bad' : ''}`}>{money(y.cumulative, ctx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Profit is revenue minus opex minus the monthly capital charge (depreciation plus financing). Net cash ignores
          the capital charge because the capex was paid on day 0.
        </p>
      </Card>
    </div>
  )
}
