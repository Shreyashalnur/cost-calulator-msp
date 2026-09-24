import { Card, MoneyField, NumField, Pill, Segmented, Switch } from '../components/ui'
import { HOURS_PER_MONTH, opexItemMonthly } from '../model/calc'
import { money, num } from '../model/format'
import type { Facility, OpexCategory, OpexDriver, OpexItem } from '../model/types'
import { patchSection, useStore } from '../state/context'

const CATEGORY_LABEL: Record<OpexCategory, string> = {
  licensing: 'Licensing',
  people: 'People',
  tools: 'Tools',
  insurance: 'Insurance',
  other: 'Other',
}

const DRIVER_LABEL: Record<OpexDriver, string> = {
  fixed: 'Fixed × qty',
  perCore: 'Per physical core',
  perVm: 'Per VM sold',
  pctCapex: '% of capex / yr',
}

export function RunningCostsView() {
  return (
    <div className="stack">
      <div className="grid three">
        <ColocationCard />
        <PowerCard />
        <ConnectivityCard />
      </div>
      <OpexTable />
      <OpexSummary />
    </div>
  )
}

function useFacility() {
  const { model, update } = useStore()
  const set = (patch: Partial<Facility>) => update(patchSection('facility', patch))
  return { f: model.facility, set }
}

function ColocationCard() {
  const { results, money: ctx } = useStore()
  const { f, set } = useFacility()
  const t = results.totals
  return (
    <Card title="Colocation" sub="Rack space and on-site services at the data centre.">
      <div className="form-grid">
        <div className="field">
          <span className="field-label" id="racks-label">Racks</span>
          <Segmented<'auto' | 'manual'>
            id="racks-mode"
            value={f.racksOverride === null ? 'auto' : 'manual'}
            options={[
              { value: 'auto', label: `Auto (${t.racksAuto})` },
              { value: 'manual', label: 'Manual' },
            ]}
            onChange={(v) => set({ racksOverride: v === 'auto' ? null : t.racksAuto })}
          />
          <span className="field-hint">
            {num(t.rackUnits)}U of equipment, {num(t.itLoadKw, 2)} kW.
          </span>
        </div>
        {f.racksOverride !== null && (
          <NumField id="racks" label="Racks (manual)" value={f.racksOverride} min={1} max={50} decimals={0} onChange={(v) => set({ racksOverride: Math.round(v) })} />
        )}
        <NumField id="usable-u" label="Usable U per rack" value={f.usableUPerRack} min={1} max={52} decimals={0} suffix="U" onChange={(v) => set({ usableUPerRack: v })} />
        <NumField id="kw-rack" label="Power limit per rack" value={f.maxKwPerRack} min={0.5} max={40} suffix="kW" onChange={(v) => set({ maxKwPerRack: v })} hint="Most Indian colos sell 4–6 kW racks." />
        <MoneyField id="rack-fee" label="Rack fee / rack / month" value={f.rackFee} min={0} onChange={(v) => set({ rackFee: v })} hint="Space only, power billed separately." />
        <NumField id="xc" label="Cross-connects" value={f.crossConnects} min={0} decimals={0} onChange={(v) => set({ crossConnects: v })} />
        <MoneyField id="xc-fee" label="Per cross-connect / month" value={f.crossConnectFee} min={0} onChange={(v) => set({ crossConnectFee: v })} />
        <MoneyField id="rh" label="Remote hands / month" value={f.remoteHands} min={0} onChange={(v) => set({ remoteHands: v })} />
        <MoneyField id="setup" label="Install & setup fee (one-time)" value={f.setupFee} min={0} onChange={(v) => set({ setupFee: v })} hint="Added to capex." />
      </div>
      <p className="card-total">
        <span>Colocation / month</span>
        <strong>{money(results.monthly.colocation, ctx)}</strong>
      </p>
    </Card>
  )
}

function PowerCard() {
  const { results, money: ctx } = useStore()
  const { f, set } = useFacility()
  const t = results.totals
  const perKw = f.powerMode === 'metered' ? HOURS_PER_MONTH * f.pue * f.tariffPerKwh : f.pricePerKwMonth
  return (
    <Card title="Power & cooling" sub="Typical draw is summed from the BOM, not nameplate PSU ratings.">
      <div className="form-grid">
        <div className="field">
          <span className="field-label" id="load-label">IT load</span>
          <Segmented<'auto' | 'manual'>
            id="load-mode"
            value={f.itLoadOverrideKw === null ? 'auto' : 'manual'}
            options={[
              { value: 'auto', label: `From BOM (${num(t.itLoadAutoKw, 2)} kW)` },
              { value: 'manual', label: 'Manual' },
            ]}
            onChange={(v) => set({ itLoadOverrideKw: v === 'auto' ? null : Math.round(t.itLoadAutoKw * 10) / 10 })}
          />
        </div>
        {f.itLoadOverrideKw !== null && (
          <NumField id="load" label="IT load (manual)" value={f.itLoadOverrideKw} min={0} suffix="kW" onChange={(v) => set({ itLoadOverrideKw: v })} />
        )}
        <Segmented<Facility['powerMode']>
          id="power-mode"
          label="Billing"
          value={f.powerMode}
          options={[
            { value: 'metered', label: 'Metered kWh' },
            { value: 'committed', label: 'Committed kW' },
          ]}
          onChange={(v) => set({ powerMode: v })}
        />
        {f.powerMode === 'metered' ? (
          <>
            <MoneyField id="tariff" label="Tariff per kWh" value={f.tariffPerKwh} min={0} decimals={3} onChange={(v) => set({ tariffPerKwh: v })} />
            <NumField id="pue" label="PUE" value={f.pue} min={1} max={3} decimals={2} onChange={(v) => set({ pue: v })} hint="Cooling and losses on top of IT load. 1.4–1.7 is typical." />
          </>
        ) : (
          <MoneyField id="per-kw" label="Per committed kW / month" value={f.pricePerKwMonth} min={0} onChange={(v) => set({ pricePerKwMonth: v })} hint="Cooling is usually included." />
        )}
      </div>
      <p className="card-total">
        <span>
          Power / month <span className="muted">({money(perKw, ctx)} per kW)</span>
        </span>
        <strong>{money(results.monthly.power, ctx)}</strong>
      </p>
    </Card>
  )
}

function ConnectivityCard() {
  const { results, money: ctx } = useStore()
  const { f, set } = useFacility()
  return (
    <Card title="Internet & IPs" sub="Tenant-facing transit and public addresses.">
      <div className="form-grid">
        <NumField id="mbps" label="Committed bandwidth" value={f.bandwidthMbps} min={0} decimals={0} suffix="Mbps" onChange={(v) => set({ bandwidthMbps: v })} />
        <MoneyField id="per-mbps" label="Per Mbps / month" value={f.pricePerMbps} min={0} onChange={(v) => set({ pricePerMbps: v })} />
        <NumField id="ips" label="Public IPv4 addresses" value={f.publicIps} min={0} decimals={0} onChange={(v) => set({ publicIps: v })} />
        <MoneyField id="per-ip" label="Per IP / month" value={f.pricePerIp} min={0} onChange={(v) => set({ pricePerIp: v })} />
      </div>
      <p className="card-total">
        <span>Connectivity / month</span>
        <strong>{money(results.monthly.connectivity, ctx)}</strong>
      </p>
    </Card>
  )
}

function OpexTable() {
  const { model, results, update, money: ctx } = useStore()
  const cores = results.totals.physicalCores
  const capex = results.totals.totalCapex
  const set = (id: string, patch: Partial<OpexItem>) =>
    update((m) => ({ ...m, opex: m.opex.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const add = () =>
    update((m) => ({
      ...m,
      opex: [
        ...m.opex,
        { id: `op-${Date.now()}`, name: 'New running cost', enabled: true, category: 'other', driver: 'fixed', qty: 1, unitCost: 0, period: 'month' },
      ],
    }))
  const remove = (id: string) => update((m) => ({ ...m, opex: m.opex.filter((i) => i.id !== id) }))
  return (
    <Card
      title="Licences, people, tools & insurance"
      sub={`Per-core items use the ${num(cores)} physical cores in the BOM. Per-VM items scale with VMs sold.`}
      actions={
        <button type="button" className="btn" onClick={add}>
          Add cost
        </button>
      }
    >
      <div className="table-wrap">
        <table className="data opex">
          <thead>
            <tr>
              <th scope="col">On</th>
              <th scope="col">Cost</th>
              <th scope="col">Type</th>
              <th scope="col">Basis</th>
              <th scope="col" className="num">Qty / FTE</th>
              <th scope="col" className="num">Unit cost</th>
              <th scope="col">Per</th>
              <th scope="col" className="num">Per month</th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {model.opex.map((i) => {
              const each = opexItemMonthly(i, cores, capex)
              const monthly = i.driver === 'perVm' ? each * results.vms.sold : each
              return (
                <tr key={i.id} className={i.enabled ? undefined : 'off'}>
                  <td>
                    <Switch id={`${i.id}-on`} checked={i.enabled} ariaLabel={`Include ${i.name}`} onChange={(v) => set(i.id, { enabled: v })} />
                  </td>
                  <td className="desc">
                    <input id={`${i.id}-name`} className="text-cell" value={i.name} aria-label="Cost name" onChange={(e) => set(i.id, { name: e.target.value })} />
                    {i.note && <span className="note">{i.note}</span>}
                  </td>
                  <td>
                    <select id={`${i.id}-cat`} value={i.category} aria-label="Type" onChange={(e) => set(i.id, { category: e.target.value as OpexCategory })}>
                      {(Object.keys(CATEGORY_LABEL) as OpexCategory[]).map((k) => (
                        <option key={k} value={k}>
                          {CATEGORY_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select id={`${i.id}-driver`} value={i.driver} aria-label="Basis" onChange={(e) => set(i.id, { driver: e.target.value as OpexDriver })}>
                      {(Object.keys(DRIVER_LABEL) as OpexDriver[]).map((k) => (
                        <option key={k} value={k}>
                          {DRIVER_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    {i.driver === 'fixed' ? (
                      <NumField cell id={`${i.id}-qty`} ariaLabel="Quantity" value={i.qty} min={0} onChange={(v) => set(i.id, { qty: v })} />
                    ) : (
                      <span className="muted">{i.driver === 'perCore' ? `${num(cores)} cores` : i.driver === 'perVm' ? `${num(results.vms.sold)} VMs` : '—'}</span>
                    )}
                  </td>
                  <td className="num">
                    {i.driver === 'pctCapex' ? (
                      <NumField cell id={`${i.id}-cost`} ariaLabel="Percent of capex per year" value={i.unitCost} min={0} max={100} suffix="%" onChange={(v) => set(i.id, { unitCost: v })} />
                    ) : (
                      <MoneyField cell id={`${i.id}-cost`} ariaLabel="Unit cost" value={i.unitCost} min={0} onChange={(v) => set(i.id, { unitCost: v })} />
                    )}
                  </td>
                  <td>
                    {i.driver === 'pctCapex' ? (
                      <span className="muted">year</span>
                    ) : (
                      <select id={`${i.id}-period`} value={i.period} aria-label="Period" onChange={(e) => set(i.id, { period: e.target.value as OpexItem['period'] })}>
                        <option value="month">month</option>
                        <option value="year">year</option>
                      </select>
                    )}
                  </td>
                  <td className="num strong">{i.enabled ? money(monthly, ctx) : <Pill tone="muted">off</Pill>}</td>
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

function OpexSummary() {
  const { model, results, update, money: ctx } = useStore()
  const rows = results.breakdown.filter((b) => b.kind === 'opex')
  const total = rows.reduce((s, r) => s + r.monthly, 0)
  return (
    <div className="grid two">
      <Card title="Corporate overhead" sub="G&A, sales, finance and office cost that every service must carry.">
        <NumField
          id="overhead"
          label="Overhead on operating costs"
          value={model.finance.overheadPct}
          min={0}
          max={100}
          suffix="%"
          decimals={1}
          onChange={(v) => update(patchSection('finance', { overheadPct: v }))}
          hint="Applied to every opex line, including per-VM costs."
        />
      </Card>
      <Card title="Opex at target occupancy" sub={`${num(results.vms.sold)} VMs sold.`}>
        <table className="plain">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="num">{money(r.monthly, ctx)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Opex / month</th>
              <td className="num">{money(total, ctx)}</td>
            </tr>
            <tr>
              <th scope="row">Opex / year</th>
              <td className="num">{money(total * 12, ctx)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  )
}

