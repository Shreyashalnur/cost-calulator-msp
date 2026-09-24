import type { ReactNode } from 'react'
import { CostCurveChart } from '../components/charts'
import { Card, Meter, Pill, Slider, Switch } from '../components/ui'
import type { Results } from '../model/calc'
import { money, num, pct, type MoneyCtx } from '../model/format'
import type { Model, Resource } from '../model/types'
import { patchSection, useStore } from '../state/context'
import { RESOURCE_LABEL, RESOURCE_WORD } from './labels'
import type { ViewProps } from './types'


export function Overview({ go }: ViewProps) {
  return (
    <div className="grid overview">
      <Card title="What the numbers say" sub="Read from the current inputs. Change a lever and they update." className="span-2">
        <Insights go={go} />
      </Card>
      <Card title="Quick levers" sub="The inputs that move cost per VM the most." className="levers-card">
        <Levers />
      </Card>
      <Card
        title="Where each VM's cost goes"
        sub="Monthly cost at target occupancy. Capex is spread over the term."
        actions={
          <button type="button" className="link" onClick={() => go('opex')}>
            Edit running costs
          </button>
        }
      >
        <Breakdown />
      </Card>
      <Card
        title="Cost per VM falls as you fill the cluster"
        sub="Shaded area: occupancy where each VM loses money at the planned price."
        actions={
          <button type="button" className="link" onClick={() => go('pricing')}>
            Edit pricing
          </button>
        }
      >
        <CostCurveChart />
      </Card>
      <Card
        title="Capacity by cluster"
        sub="Share of each sellable resource used when the cluster is full."
        actions={
          <button type="button" className="link" onClick={() => go('capacity')}>
            Edit capacity
          </button>
        }
      >
        <CapacitySummary />
      </Card>
      <Card
        title="Investment"
        sub="Net of quote discounts, before taxes."
        actions={
          <button type="button" className="link" onClick={() => go('capex')}>
            Edit BOM
          </button>
        }
      >
        <Investment />
      </Card>
    </div>
  )
}

function Levers() {
  const { model, update } = useStore()
  const c = model.capacity
  return (
    <div className="levers">
      <Slider
        id="lv-occ"
        label="Target occupancy"
        value={c.targetOccupancyPct}
        min={30}
        max={100}
        step={1}
        display={`${c.targetOccupancyPct}%`}
        onChange={(v) => update(patchSection('capacity', { targetOccupancyPct: v }))}
      />
      <Slider
        id="lv-vcpu"
        label="vCPUs per physical core"
        value={c.vcpuPerCore}
        min={1}
        max={10}
        step={0.5}
        display={`${c.vcpuPerCore}:1`}
        onChange={(v) => update(patchSection('capacity', { vcpuPerCore: v }))}
      />
      <Slider
        id="lv-margin"
        label="Target gross margin"
        value={model.pricing.targetMarginPct}
        min={0}
        max={70}
        step={1}
        display={`${model.pricing.targetMarginPct}%`}
        onChange={(v) => update(patchSection('pricing', { targetMarginPct: v }))}
      />
      <Slider
        id="lv-disc"
        label="Cisco hardware discount"
        value={model.discounts.hardware}
        min={0}
        max={80}
        step={1}
        display={`${model.discounts.hardware}% off list`}
        onChange={(v) => update((m) => ({ ...m, discounts: { ...m.discounts, hardware: v } }))}
      />
      <Switch
        id="lv-ha"
        checked={c.haReserve}
        onChange={(v) => update(patchSection('capacity', { haReserve: v }))}
        label="Hold back one node per cluster (N+1)"
      />
    </div>
  )
}

function Breakdown() {
  const { results, money: ctx } = useStore()
  const rows = [...results.breakdown].filter((b) => b.monthly > 0.005).sort((a, b) => b.monthly - a.monthly)
  const total = rows.reduce((s, r) => s + r.monthly, 0)
  const capex = rows.filter((r) => r.kind === 'capex').reduce((s, r) => s + r.monthly, 0)
  const max = rows[0]?.monthly ?? 1
  return (
    <div className="breakdown">
      <div className="split" aria-label={`Capex ${pct(capex / total)} and opex ${pct(1 - capex / total)} of monthly cost`}>
        <span className="split-capex" style={{ width: `${(capex / total) * 100}%` }}>
          Capex {pct(capex / total)}
        </span>
        <span className="split-opex">Opex {pct(1 - capex / total)}</span>
      </div>
      <table className="bars">
        <thead>
          <tr>
            <th scope="col">Cost line</th>
            <th scope="col" className="num">
              Per month
            </th>
            <th scope="col" className="num">
              Per VM
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <span className="bar-label">{r.label}</span>
                <span className={`bar tone-${r.kind}`}>
                  <span style={{ width: `${(r.monthly / max) * 100}%` }} />
                </span>
              </td>
              <td className="num">{money(r.monthly, ctx)}</td>
              <td className="num">{money(r.perVm, ctx)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num">{money(total, ctx)}</td>
            <td className="num">{money(results.unit.costPerVm, ctx)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="legend">
        <span className="key tone-capex" /> Capex, spread over the term <span className="key tone-opex" /> Opex, paid
        monthly
      </p>
    </div>
  )
}

function CapacitySummary() {
  const { results } = useStore()
  return (
    <div className="cap-summary">
      {results.clusters.map((c) => (
        <div key={c.groupId} className="cap-row">
          <div className="cap-row-head">
            <strong>{c.name}</strong>
            {c.role === 'dr' ? <Pill tone="muted">DR target</Pill> : <Pill tone="accent">{num(c.maxVms)} VMs</Pill>}
          </div>
          <p className="cap-row-sub">
            {c.nodes} × {num(c.coresPerNode)} cores · {num(c.ramPerNodeGb)} GB · {num(c.rawTb, 1)} TB raw.{' '}
            {c.binding && c.hostableVms > 0 ? (
              <>
                Runs out of <strong>{RESOURCE_WORD[c.binding]}</strong> first.
              </>
            ) : (
              'No sellable capacity.'
            )}
          </p>
          <dl className="meters">
            {(['cpu', 'ram', 'storage'] as Resource[]).map((r) => (
              <div key={r}>
                <dt>{RESOURCE_LABEL[r]}</dt>
                <dd>
                  <Meter value={c.usedAtMax[r]} tone={r === c.binding ? 'warn' : 'accent'} label={`${RESOURCE_LABEL[r]} used`} />
                  <span className="num">{pct(c.usedAtMax[r])}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

function Investment() {
  const { results, money: ctx } = useStore()
  const { totals, monthly } = results
  return (
    <div className="investment">
      <table className="plain">
        <tbody>
          {results.groups.map((g) => (
            <tr key={g.group.id}>
              <th scope="row">{g.group.name}</th>
              <td className="num">{money(g.net, ctx)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Setup, services, spares & colocation install</th>
            <td className="num">{money(totals.oneTime, ctx)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total upfront capex</th>
            <td className="num">{money(totals.totalCapex, ctx)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mini-kpis">
        <div>
          <span>Capital charge / month</span>
          <strong>{money(monthly.capitalCharge, ctx)}</strong>
        </div>
        <div>
          <span>Opex / month at target</span>
          <strong>{money(monthly.opexAtTarget, ctx)}</strong>
        </div>
        <div>
          <span>Quote discount vs list</span>
          <strong>{pct(1 - totals.bomNet / Math.max(1, totals.bomList))}</strong>
        </div>
      </div>
    </div>
  )
}

interface Insight {
  tone: 'good' | 'warn' | 'bad' | 'accent'
  tag: string
  body: ReactNode
}

function buildInsights(model: Model, r: Results, ctx: MoneyCtx): Insight[] {
  const out: Insight[] = []
  const total = r.breakdown.reduce((s, b) => s + b.monthly, 0)

  for (const c of r.clusters) {
    if (c.role === 'dr') {
      out.push({
        tone: 'warn',
        tag: 'DR cluster',
        body: (
          <>
            <strong>{c.name}</strong> is a DR target. Its cost is carried by VMs on the production clusters, so plan for
            a DR add-on price.
          </>
        ),
      })
      continue
    }
    if (!c.binding || c.hostableVms === 0) continue
    const idle = (['cpu', 'ram', 'storage'] as Resource[])
      .filter((x) => x !== c.binding && x !== 'storage' && c.usedAtMax[x] < 0.8)
      .map((x) => `${pct(1 - c.usedAtMax[x])} of its ${RESOURCE_WORD[x]}`)
    const fix =
      c.binding === 'cpu'
        ? 'Sell memory-heavy sizes here or raise the vCPU ratio if workloads are light.'
        : c.binding === 'ram'
          ? 'Add DIMMs here or steer CPU-heavy sizes to this cluster.'
          : 'Add drives or sell smaller disks per VM.'
    out.push({
      tone: idle.length ? 'warn' : 'accent',
      tag: `Limited by ${RESOURCE_WORD[c.binding]}`,
      body: (
        <>
          <strong>{c.name}</strong> fills up at {num(c.maxVms)} VMs because {RESOURCE_WORD[c.binding]} runs
          out first.{idle.length ? ` ${idle.join(' and ')} would sit unsold.` : ''} {fix}
        </>
      ),
    })
  }

  const prod = r.clusters.filter((c) => c.role === 'production')
  const storageSellable = prod.reduce((s, c) => s + c.sellable.storage, 0)
  const storageUsed = prod.reduce((s, c) => s + c.maxVms * r.avgVm.storageGb, 0)
  if (storageSellable > 0 && storageUsed / storageSellable < 0.5) {
    out.push({
      tone: 'accent',
      tag: 'Spare storage',
      body: (
        <>
          With every cluster full, the VM mix uses only {pct(storageUsed / storageSellable)} of sellable storage. Sell
          the rest as extra disk, backup targets or file shares at the storage rate on the Pricing tab.
        </>
      ),
    })
  }

  const top = [...r.breakdown].sort((a, b) => b.monthly - a.monthly).slice(0, 3)
  if (total > 0 && top.length) {
    out.push({
      tone: 'accent',
      tag: 'Biggest costs',
      body: (
        <>
          Largest lines: {top.map((t) => `${t.label} ${pct(t.monthly / total)}`).join(' · ')}. Together they are{' '}
          {pct(top.reduce((s, t) => s + t.monthly, 0) / total)} of the monthly cost. Shared costs like these get cheaper
          per VM as you add nodes.
        </>
      ),
    })
  }

  if (r.vms.breakEven !== null && r.vms.breakEvenOccupancyPct !== null) {
    const be = r.vms.breakEvenOccupancyPct
    out.push({
      tone: be > model.capacity.targetOccupancyPct ? 'bad' : be > 60 ? 'warn' : 'good',
      tag: 'Break-even',
      body: (
        <>
          At {money(r.unit.pricePerVm, ctx)} per VM you cover every cost at {num(Math.ceil(r.vms.breakEven))} VMs (
          {num(be)}% occupancy).{' '}
          {be > model.capacity.targetOccupancyPct
            ? 'That is above your target occupancy, so the plan loses money.'
            : `Every VM sold beyond that adds about ${money((r.unit.pricePerVm ?? 0) - r.monthly.variablePerVm, ctx)} a month.`}
        </>
      ),
    })
  } else {
    out.push({ tone: 'bad', tag: 'Break-even', body: 'The price does not cover the per-VM variable cost. Raise the margin.' })
  }

  const pb = r.cashflow.paybackMonth
  out.push({
    tone: pb === null ? 'bad' : pb > model.finance.termMonths * 0.7 ? 'warn' : 'good',
    tag: 'Payback',
    body:
      pb === null ? (
        <>The upfront spend is not paid back within the {model.finance.termMonths}-month term. Raise the price or occupancy, or cut shared cost.</>
      ) : (
        <>
          Cash payback in month {pb}, assuming sales take {model.pricing.rampMonths} months to reach target. Term profit
          after the capital charge: {money(r.cashflow.totalProfit, ctx, { compact: true })}
          {r.cashflow.irrAnnualPct !== null ? `, project IRR ${num(r.cashflow.irrAnnualPct, 1)}%` : ''}.
        </>
      ),
  })
  return out
}

function Insights({ go }: ViewProps) {
  const { model, results, money: ctx } = useStore()
  const items = buildInsights(model, results, ctx)
  return (
    <>
      <ul className="insights">
        {items.map((it, i) => (
          <li key={i} className={`tone-${it.tone}`}>
            <Pill tone={it.tone}>{it.tag}</Pill>
            <p>{it.body}</p>
          </li>
        ))}
      </ul>
      <p className="insights-foot">
        New to IaaS pricing?{' '}
        <button type="button" className="link" onClick={() => go('playbook')}>
          Read how MSPs build a price
        </button>
      </p>
    </>
  )
}
