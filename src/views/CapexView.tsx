import { useState } from 'react'
import { Card, MoneyField, NumField, Pill, Segmented, Switch } from '../components/ui'
import { lineDiscountPct, lineTotalQty, lineUnitNet } from '../model/calc'
import { money, num, pct } from '../model/format'
import type { BomGroup, BomLine, LineCategory, Model, OneTimeItem } from '../model/types'
import { patchSection, useStore } from '../state/context'

const CATEGORY_LABEL: Record<LineCategory, string> = {
  hardware: 'Hardware',
  software: 'Software / term licence',
  support: 'Support service',
}

function updateGroup(m: Model, id: string, fn: (g: BomGroup) => BomGroup): Model {
  return { ...m, groups: m.groups.map((g) => (g.id === id ? fn(g) : g)) }
}

export function CapexView() {
  const { model, results } = useStore()
  return (
    <div className="stack">
      <div className="grid three">
        <Discounts />
        <CapexSummary />
        <FinanceCard />
      </div>
      <p className="callout">
        The SKUs and quantities come from your Cisco BOM. <strong>The unit list prices are placeholders.</strong> Type
        your quote's unit list price and discount, or type the unit net price directly and the discount is worked out
        for you.
      </p>
      {model.groups.map((g, i) => (
        <GroupTable key={g.id} group={g} startOpen={i === 0} net={results.groups.find((x) => x.group.id === g.id)!.net} />
      ))}
      <OneTimeTable />
    </div>
  )
}

function Discounts() {
  const { model, update } = useStore()
  const set = (k: LineCategory, v: number) => update((m) => ({ ...m, discounts: { ...m.discounts, [k]: v } }))
  return (
    <Card title="Quote discounts" sub="Default discount off list, by line type. A line can override it.">
      <div className="form-grid">
        {(Object.keys(CATEGORY_LABEL) as LineCategory[]).map((k) => (
          <NumField key={k} id={`disc-${k}`} label={CATEGORY_LABEL[k]} value={model.discounts[k]} min={0} max={100} suffix="%" decimals={1} onChange={(v) => set(k, v)} />
        ))}
      </div>
    </Card>
  )
}

function CapexSummary() {
  const { results, money: ctx } = useStore()
  const t = results.totals
  const rows: [string, number][] = [
    ['Hardware', t.hardwareNet],
    ['Prepaid software & term licences', t.softwareNet],
    ['Prepaid support (SNTC, SW support)', t.supportNet],
    ['Setup, services, spares & colo install', t.oneTime],
  ]
  return (
    <Card title="Capex summary" sub="Everything paid before the first VM goes live.">
      <table className="plain">
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td className="num">{money(v, ctx)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total capex</th>
            <td className="num">{money(t.totalCapex, ctx)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="muted small">
        List value {money(t.bomList, ctx, { compact: true })}, quote net {money(t.bomNet, ctx, { compact: true })} (
        {pct(1 - t.bomNet / Math.max(1, t.bomList))} blended discount).
      </p>
    </Card>
  )
}

function FinanceCard() {
  const { model, results, update, money: ctx } = useStore()
  const f = model.finance
  return (
    <Card title="Capex to a monthly charge" sub="How the upfront spend lands in cost per VM.">
      <div className="form-grid">
        <NumField id="term" label="Term" value={f.termMonths} min={12} max={120} decimals={0} suffix="months" onChange={(v) => update(patchSection('finance', { termMonths: Math.round(v) }))} hint="Matches the 60-month Cisco service term." />
        <NumField id="coc" label="Cost of capital" value={f.costOfCapitalPct} min={0} max={40} suffix="% / yr" decimals={2} onChange={(v) => update(patchSection('finance', { costOfCapitalPct: v }))} hint="Loan, lease or equity hurdle rate. 0 gives straight-line depreciation." />
      </div>
      <dl className="facts">
        <div>
          <dt>Depreciation / month</dt>
          <dd>{money(results.monthly.depreciation, ctx)}</dd>
        </div>
        <div>
          <dt>Financing / month</dt>
          <dd>{money(results.monthly.financing, ctx)}</dd>
        </div>
        <div>
          <dt>Capital charge / month</dt>
          <dd>
            <strong>{money(results.monthly.capitalCharge, ctx)}</strong>
          </dd>
        </div>
      </dl>
    </Card>
  )
}

function GroupTable({ group, net, startOpen }: { group: BomGroup; net: number; startOpen: boolean }) {
  const { model, update, money: ctx } = useStore()
  const [open, setOpen] = useState(startOpen)
  const setLine = (id: string, patch: Partial<BomLine>) =>
    update((m) => updateGroup(m, group.id, (g) => ({ ...g, lines: g.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })))
  const removeLine = (id: string) =>
    update((m) => updateGroup(m, group.id, (g) => ({ ...g, lines: g.lines.filter((l) => l.id !== id) })))
  const addLine = () =>
    update((m) =>
      updateGroup(m, group.id, (g) => ({
        ...g,
        lines: [
          ...g.lines,
          { id: `${g.id}-x${Date.now()}`, sku: 'NEW-SKU', description: 'Added line', qty: 1, perNode: g.kind === 'cluster', unitList: 0, category: 'hardware' },
        ],
      })),
    )
  const isCluster = group.kind === 'cluster'
  const bodyId = `${group.id}-lines`
  return (
    <Card
      title={group.name}
      sub={group.note}
      actions={
        <>
          <span className="group-total">
            <span className="muted">Net</span> <strong>{money(net, ctx)}</strong>
          </span>
          <button type="button" className="btn" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
            {open ? 'Hide lines' : `Show ${group.lines.length} lines`}
          </button>
        </>
      }
    >
      {open && (
        <div id={bodyId}>
          {isCluster && (
            <p className="muted small">
              Quantities marked <em>per node</em> are multiplied by the {group.nodes} nodes set on the Capacity tab.
            </p>
          )}
          <div className="table-wrap">
            <table className="data bom">
              <thead>
                <tr>
                  <th scope="col">Part number</th>
                  <th scope="col">Description</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">Qty</th>
                  <th scope="col" className="num">Unit list</th>
                  <th scope="col" className="num">Disc.</th>
                  <th scope="col" className="num">Unit net</th>
                  <th scope="col" className="num">Extended net</th>
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((l) => {
                  const total = lineTotalQty(group, l)
                  const disc = lineDiscountPct(model, l)
                  const unitNet = lineUnitNet(model, l)
                  return (
                    <tr key={l.id} className={l.unitList === 0 ? 'zero' : undefined}>
                      <td>
                        <input id={`${l.id}-sku`} className="text-cell mono" value={l.sku} aria-label="Part number" onChange={(e) => setLine(l.id, { sku: e.target.value })} />
                      </td>
                      <td className="desc">
                        <input id={`${l.id}-desc`} className="text-cell" value={l.description} aria-label="Description" onChange={(e) => setLine(l.id, { description: e.target.value })} />
                        {l.termMonths ? <span className="term">{l.termMonths} mo</span> : null}
                      </td>
                      <td>
                        <select id={`${l.id}-cat`} value={l.category} aria-label="Line type" onChange={(e) => setLine(l.id, { category: e.target.value as LineCategory })}>
                          <option value="hardware">Hardware</option>
                          <option value="software">Software</option>
                          <option value="support">Support</option>
                        </select>
                      </td>
                      <td className="num qty">
                        <NumField cell id={`${l.id}-qty`} ariaLabel={`${l.sku} quantity`} value={l.qty} min={0} decimals={2} onChange={(v) => setLine(l.id, { qty: v })} />
                        {isCluster && l.perNode ? <span className="per-node">/node · {num(total)}</span> : null}
                      </td>
                      <td className="num">
                        <MoneyField cell id={`${l.id}-list`} ariaLabel={`${l.sku} unit list`} value={l.unitList} min={0} onChange={(v) => setLine(l.id, { unitList: v })} />
                      </td>
                      <td className="num disc">
                        <NumField cell id={`${l.id}-disc`} ariaLabel={`${l.sku} discount`} value={disc} min={-100} max={100} decimals={1} suffix="%" onChange={(v) => setLine(l.id, { discountPct: v })} />
                        {l.discountPct !== undefined && l.discountPct !== null && (
                          <button type="button" className="icon-btn" title="Use the category discount" aria-label="Use the category discount" onClick={() => setLine(l.id, { discountPct: null })}>
                            ↺
                          </button>
                        )}
                      </td>
                      <td className="num">
                        <MoneyField
                          cell
                          id={`${l.id}-net`}
                          ariaLabel={`${l.sku} unit net`}
                          value={unitNet}
                          min={0}
                          onChange={(v) =>
                            l.unitList > 0
                              ? setLine(l.id, { discountPct: Math.max(-100, Math.min(100, (1 - v / l.unitList) * 100)) })
                              : setLine(l.id, { unitList: v, discountPct: 0 })
                          }
                        />
                      </td>
                      <td className="num strong">{money(total * unitNet, ctx)}</td>
                      <td>
                        <button type="button" className="icon-btn" aria-label={`Remove ${l.sku}`} onClick={() => removeLine(l.id)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn ghost" onClick={addLine}>
            Add line
          </button>
        </div>
      )}
    </Card>
  )
}

function OneTimeTable() {
  const { model, results, update, money: ctx } = useStore()
  const set = (id: string, patch: Partial<OneTimeItem>) =>
    update((m) => ({ ...m, oneTime: m.oneTime.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const add = () =>
    update((m) => ({
      ...m,
      oneTime: [...m.oneTime, { id: `ot-${Date.now()}`, name: 'New one-time cost', enabled: true, mode: 'fixed', qty: 1, value: 0 }],
    }))
  const remove = (id: string) => update((m) => ({ ...m, oneTime: m.oneTime.filter((i) => i.id !== id) }))
  const hw = results.totals.hardwareNet
  return (
    <Card
      title="Other one-time costs"
      sub="Capex that is not on the Cisco quote. The colocation install fee is on the Running costs tab."
      actions={
        <button type="button" className="btn" onClick={add}>
          Add cost
        </button>
      }
    >
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">On</th>
              <th scope="col">Item</th>
              <th scope="col">Basis</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">Unit cost / %</th>
              <th scope="col" className="num">Total</th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {model.oneTime.map((i) => {
              const total = i.mode === 'fixed' ? i.qty * i.value : (hw * i.value) / 100
              return (
                <tr key={i.id} className={i.enabled ? undefined : 'off'}>
                  <td>
                    <Switch id={`${i.id}-on`} checked={i.enabled} ariaLabel={`Include ${i.name}`} onChange={(v) => set(i.id, { enabled: v })} />
                  </td>
                  <td>
                    <input id={`${i.id}-name`} className="text-cell" value={i.name} aria-label="Item" onChange={(e) => set(i.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <Segmented<OneTimeItem['mode']>
                      id={`${i.id}-mode`}
                      value={i.mode}
                      options={[
                        { value: 'fixed', label: 'Fixed' },
                        { value: 'pctHardware', label: '% of HW' },
                      ]}
                      onChange={(v) => set(i.id, { mode: v })}
                    />
                  </td>
                  <td className="num">
                    {i.mode === 'fixed' ? (
                      <NumField cell id={`${i.id}-qty`} ariaLabel="Quantity" value={i.qty} min={0} onChange={(v) => set(i.id, { qty: v })} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">
                    {i.mode === 'fixed' ? (
                      <MoneyField cell id={`${i.id}-value`} ariaLabel="Unit cost" value={i.value} min={0} onChange={(v) => set(i.id, { value: v })} />
                    ) : (
                      <NumField cell id={`${i.id}-value`} ariaLabel="Percent of hardware" value={i.value} min={0} max={100} suffix="%" onChange={(v) => set(i.id, { value: v })} />
                    )}
                  </td>
                  <td className="num strong">{i.enabled ? money(total, ctx) : <Pill tone="muted">off</Pill>}</td>
                  <td>
                    <button type="button" className="icon-btn" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
