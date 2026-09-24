import { Card, MoneyField, NumField, Segmented } from '../components/ui'
import { money, num, pct } from '../model/format'
import type { AddOn, Model, Resource } from '../model/types'
import { patchSection, useStore } from '../state/context'
import { RESOURCE_LABEL } from './labels'

const UNIT: Record<Resource, string> = { cpu: 'per vCPU', ram: 'per GB memory', storage: 'per GB disk' }

export function PricingView() {
  return (
    <div className="stack">
      <div className="grid three">
        <MarginCard />
        <TermCard />
        <AllocationCard />
      </div>
      <RateCard />
      <SizePriceList />
      <AddOns />
    </div>
  )
}

function usePricing() {
  const { model, update } = useStore()
  const set = (patch: Partial<Model['pricing']>) => update(patchSection('pricing', patch))
  return { p: model.pricing, set }
}

function MarginCard() {
  const { p, set } = usePricing()
  const m = p.targetMarginPct / 100
  return (
    <Card title="Margin" sub="Gross margin on the 1-year commit price.">
      <NumField
        id="margin"
        label="Target gross margin"
        value={p.targetMarginPct}
        min={0}
        max={90}
        suffix="%"
        decimals={1}
        onChange={(v) => set({ targetMarginPct: v })}
        hint={`Price = cost ÷ (1 − margin). ${p.targetMarginPct}% margin is a ${num((m / (1 - m)) * 100, 1)}% markup on cost.`}
      />
    </Card>
  )
}

function TermCard() {
  const { p, set } = usePricing()
  return (
    <Card title="Commitment tiers" sub="Pay more for flexibility, less for a longer commitment.">
      <div className="form-grid">
        <NumField id="payg" label="Pay-as-you-go uplift" value={p.paygUpliftPct} min={0} max={200} suffix="%" decimals={1} onChange={(v) => set({ paygUpliftPct: v })} hint="Monthly, cancel any time." />
        <NumField id="three" label="3-year commit discount" value={p.threeYearDiscountPct} min={0} max={90} suffix="%" decimals={1} onChange={(v) => set({ threeYearDiscountPct: v })} hint="Locks in occupancy and lowers your risk." />
      </div>
    </Card>
  )
}

function AllocationCard() {
  const { results } = useStore()
  const { p, set } = usePricing()
  const auto = results.unit.autoWeights
  return (
    <Card title="Cost split by resource" sub="How shared cost is divided between vCPU, memory and disk.">
      <Segmented<'auto' | 'manual'>
        id="weight-mode"
        value={p.weightMode}
        options={[
          { value: 'auto', label: 'From cost drivers' },
          { value: 'manual', label: 'Manual' },
        ]}
        onChange={(v) => set({ weightMode: v })}
      />
      {p.weightMode === 'auto' ? (
        <p className="muted small">
          CPU gets the processors plus per-core licences ({pct(auto.cpu)}), memory gets the DIMMs ({pct(auto.ram)}), disk
          gets the drives ({pct(auto.storage)}). Shared costs follow the same split.
        </p>
      ) : (
        <div className="form-grid">
          {(['cpu', 'ram', 'storage'] as Resource[]).map((r) => (
            <NumField
              key={r}
              id={`w-${r}`}
              label={RESOURCE_LABEL[r]}
              value={p.weights[r]}
              min={0}
              max={100}
              suffix="%"
              decimals={0}
              onChange={(v) => set({ weights: { ...p.weights, [r]: v } })}
            />
          ))}
          <p className="muted small">Scaled to 100%. Cost-driver split is {pct(auto.cpu)} / {pct(auto.ram)} / {pct(auto.storage)}.</p>
        </div>
      )}
    </Card>
  )
}

function RateCard() {
  const { model, results, money: ctx } = useStore()
  const u = results.unit
  const up = 1 + model.pricing.paygUpliftPct / 100
  const down = 1 - model.pricing.threeYearDiscountPct / 100
  const m = model.pricing.targetMarginPct / 100
  const fee = u.variablePerVm
  return (
    <Card
      title="Unit rate card"
      sub="Build any custom VM from these. At the planned mix and occupancy they recover the full monthly cost."
    >
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Resource</th>
              <th scope="col" className="num">Cost / month</th>
              <th scope="col" className="num">PAYG</th>
              <th scope="col" className="num">1-year</th>
              <th scope="col" className="num">3-year</th>
              <th scope="col" className="num">Share of cost</th>
            </tr>
          </thead>
          <tbody>
            {(['cpu', 'ram', 'storage'] as Resource[]).map((r) => (
              <tr key={r}>
                <th scope="row">
                  {RESOURCE_LABEL[r]} <span className="muted">{UNIT[r]}</span>
                </th>
                <td className="num">{money(u.costRate[r], ctx)}</td>
                <td className="num">{money(u.priceRate[r] * up, ctx)}</td>
                <td className="num strong">{money(u.priceRate[r], ctx)}</td>
                <td className="num">{money(u.priceRate[r] * down, ctx)}</td>
                <td className="num">{pct(u.weights[r])}</td>
              </tr>
            ))}
            {fee > 0 && (
              <tr>
                <th scope="row">
                  Per-VM fee <span className="muted">agents and per-VM licences</span>
                </th>
                <td className="num">{money(fee, ctx)}</td>
                <td className="num">{money((fee / (1 - m)) * up, ctx)}</td>
                <td className="num strong">{money(fee / (1 - m), ctx)}</td>
                <td className="num">{money((fee / (1 - m)) * down, ctx)}</td>
                <td className="num muted">variable</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Storage is priced per GB of usable, protected (RF{model.capacity.replicationFactor}) capacity. Tenants see the
        GB they provision; replication and rebuild reserve are inside the rate.
      </p>
    </Card>
  )
}

function SizePriceList() {
  const { results, money: ctx } = useStore()
  return (
    <Card title="VM price list" sub="Monthly price per VM size in each commitment tier. Margin shown under each price.">
      <div className="table-wrap">
        <table className="data prices">
          <thead>
            <tr>
              <th scope="col">Size</th>
              <th scope="col">Spec</th>
              <th scope="col" className="num">Cost</th>
              <th scope="col" className="num">PAYG</th>
              <th scope="col" className="num">1-year</th>
              <th scope="col" className="num">3-year</th>
            </tr>
          </thead>
          <tbody>
            {results.sizes.map((s) => (
              <tr key={s.size.id}>
                <th scope="row">{s.size.name}</th>
                <td className="muted">
                  {num(s.size.vcpu)} vCPU · {num(s.size.ramGb)} GB · {num(s.size.storageGb)} GB disk
                </td>
                <td className="num">{money(s.cost, ctx)}</td>
                <td className="num">
                  {money(s.payg, ctx)}
                  <span className="sub">{pct(s.marginPayg)}</span>
                </td>
                <td className="num strong">
                  {money(s.price, ctx)}
                  <span className="sub">{pct(s.marginOneYear)}</span>
                </td>
                <td className="num">
                  {money(s.threeYear, ctx)}
                  <span className="sub">{pct(s.marginThreeYear)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function AddOns() {
  const { model, update, money: ctx } = useStore()
  const p = model.pricing
  const m = p.addOnMarginPct / 100
  const set = (id: string, patch: Partial<AddOn>) =>
    update((x) => ({ ...x, pricing: { ...x.pricing, addOns: x.pricing.addOns.map((a) => (a.id === id ? { ...a, ...patch } : a)) } }))
  const add = () =>
    update((x) => ({
      ...x,
      pricing: { ...x.pricing, addOns: [...x.pricing.addOns, { id: `ao-${Date.now()}`, name: 'New add-on', unit: 'per VM', cost: 0 }] },
    }))
  const remove = (id: string) =>
    update((x) => ({ ...x, pricing: { ...x.pricing, addOns: x.pricing.addOns.filter((a) => a.id !== id) } }))
  return (
    <Card
      title="Add-on services"
      sub="Priced on top of the VM. Most MSP margin comes from these, not from raw compute."
      actions={
        <button type="button" className="btn" onClick={add}>
          Add service
        </button>
      }
    >
      <div className="form-row">
        <NumField
          id="addon-margin"
          label="Add-on margin"
          value={p.addOnMarginPct}
          min={0}
          max={90}
          suffix="%"
          decimals={1}
          onChange={(v) => update(patchSection('pricing', { addOnMarginPct: v }))}
        />
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Unit</th>
              <th scope="col" className="num">Your cost / month</th>
              <th scope="col" className="num">Price / month</th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {p.addOns.map((a) => (
              <tr key={a.id}>
                <td>
                  <input id={`${a.id}-name`} className="text-cell" value={a.name} aria-label="Service" onChange={(e) => set(a.id, { name: e.target.value })} />
                </td>
                <td>
                  <input id={`${a.id}-unit`} className="text-cell" value={a.unit} aria-label="Unit" onChange={(e) => set(a.id, { unit: e.target.value })} />
                </td>
                <td className="num">
                  <MoneyField cell id={`${a.id}-cost`} ariaLabel={`${a.name} cost`} value={a.cost} min={0} onChange={(v) => set(a.id, { cost: v })} />
                </td>
                <td className="num strong">{money(a.cost / (1 - Math.min(m, 0.95)), ctx)}</td>
                <td>
                  <button type="button" className="icon-btn" aria-label={`Remove ${a.name}`} onClick={() => remove(a.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
