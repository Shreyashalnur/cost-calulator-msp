import { useEffect, useRef, useState } from 'react'
import { money, num } from './model/format'
import type { Currency } from './model/types'
import { NumField, Segmented } from './components/ui'
import { useStore } from './state/context'
import { parseModel } from './state/persistence'
import { Overview } from './views/Overview'
import { CapacityView } from './views/CapacityView'
import { CapexView } from './views/CapexView'
import { RunningCostsView } from './views/RunningCostsView'
import { PricingView } from './views/PricingView'
import { CashflowView } from './views/CashflowView'
import { PlaybookView } from './views/PlaybookView'
import type { TabId } from './views/types'

const TABS = [
  { id: 'overview', label: 'Overview', View: Overview },
  { id: 'capacity', label: 'Capacity', View: CapacityView },
  { id: 'capex', label: 'Hardware & capex', View: CapexView },
  { id: 'opex', label: 'Running costs', View: RunningCostsView },
  { id: 'pricing', label: 'Pricing & rate card', View: PricingView },
  { id: 'cashflow', label: 'Cash flow', View: CashflowView },
  { id: 'playbook', label: 'How MSPs price', View: PlaybookView },
] as const satisfies readonly { id: TabId; label: string; View: unknown }[]

function tabFromHash(): TabId {
  const h = window.location.hash.replace('#', '')
  return TABS.find((t) => t.id === h)?.id ?? 'overview'
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (id: TabId) => {
    setTab(id)
    try {
      window.history.replaceState(null, '', `#${id}`)
    } catch {
      // Some sandboxed frames refuse history changes; the tab still switches.
    }
  }
  const Active = TABS.find((t) => t.id === tab)!.View

  return (
    <div className="app">
      <Header />
      <div className="sticky-bar">
        <KpiStrip />
        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={t.id === tab}
              aria-controls="panel"
              className={t.id === tab ? 'on' : undefined}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <main id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <Active go={go} />
      </main>
      <footer className="foot">
        <p>
          Unit list prices are indicative placeholders, not a Cisco or Nutanix quote. Replace them with your quoted net
          prices on the Hardware &amp; capex tab. Figures exclude GST and other taxes. Your edits are saved in this
          browser.
        </p>
      </footer>
    </div>
  )
}

/** Embedded previews (iframes) usually block downloads, so offer copy only there. */
const canDownload = (() => {
  try {
    return window.self === window.top
  } catch {
    return false
  }
})()

function Header() {
  const { model, results, update, replace, reset } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const clusters = results.clusters.length

  const copyJson = () => {
    const text = JSON.stringify(model, null, 2)
    navigator.clipboard
      .writeText(text)
      .then(() => setNotice('Scenario copied. Paste it into a .json file to keep or share it.'))
      .catch(() => setNotice('This browser blocked clipboard access. Use Export scenario instead.'))
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nutanix-msp-cost-model.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        replace(parseModel(String(reader.result)))
        setNotice(`Loaded ${file.name}.`)
      } catch {
        setNotice(`${file.name} is not a scenario file exported from this calculator.`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <header className="masthead">
      <div className="brand">
        <p className="eyebrow">MSP private cloud · Cisco Compute Hyperconverged M8 × Nutanix AHV</p>
        <h1>Nutanix MSP Cost Model</h1>
        <p className="meta">
          {results.totals.nodes} nodes in {clusters} clusters · {num(results.totals.physicalCores)} physical cores ·{' '}
          {model.finance.termMonths}-month term · {money(results.totals.totalCapex, { currency: model.currency, fx: model.fxInrPerUsd }, { compact: true })} upfront
        </p>
      </div>
      <div className="masthead-controls">
        <Segmented<Currency>
          id="currency"
          value={model.currency}
          options={[
            { value: 'INR', label: '₹ INR' },
            { value: 'USD', label: '$ USD' },
          ]}
          onChange={(c) => update((m) => ({ ...m, currency: c }))}
        />
        <div className="fx">
          <NumField
            id="fx"
            label="₹ per $1"
            value={model.fxInrPerUsd}
            min={1}
            decimals={2}
            onChange={(v) => update((m) => ({ ...m, fxInrPerUsd: v }))}
          />
        </div>
        <div className="scenario-actions">
          {canDownload && (
            <button type="button" className="btn" onClick={exportJson}>
              Export scenario
            </button>
          )}
          <button type="button" className="btn" onClick={copyJson}>
            Copy scenario
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            id="import-file"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }}
          />
          {confirmReset ? (
            <span className="confirm">
              <span>Discard your edits?</span>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  reset()
                  setConfirmReset(false)
                  setNotice('Restored the default scenario.')
                }}
              >
                Reset
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
              Reset to defaults
            </button>
          )}
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </header>
  )
}

function KpiStrip() {
  const { model, results, money: ctx } = useStore()
  const { unit, vms, monthly, totals, cashflow, avgVm } = results
  const payback = cashflow.paybackMonth
  return (
    <div className="kpis">
      <div className="kpi">
        <span className="kpi-label">Cost per VM / month</span>
        <span className="kpi-value">{money(unit.costPerVm, ctx)}</span>
        <span className="kpi-sub">
          avg VM {num(avgVm.vcpu, 1)} vCPU · {num(avgVm.ramGb, 1)} GB · {num(avgVm.storageGb)} GB disk
        </span>
      </div>
      <div className="kpi kpi-price">
        <span className="kpi-label">Price per VM / month</span>
        <span className="kpi-value">{money(unit.pricePerVm, ctx)}</span>
        <span className="kpi-sub">
          {model.pricing.targetMarginPct}% gross margin · 1-year term
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">VMs sold at target</span>
        <span className="kpi-value">
          {num(vms.sold)}
          <small> / {num(vms.max)}</small>
        </span>
        <span className="kpi-sub">{model.capacity.targetOccupancyPct}% of sellable capacity</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Break-even</span>
        <span className="kpi-value">{vms.breakEven === null ? 'Never' : `${num(Math.ceil(vms.breakEven))} VMs`}</span>
        <span className="kpi-sub">
          {vms.breakEvenOccupancyPct === null ? 'price is below variable cost' : `${num(vms.breakEvenOccupancyPct)}% occupancy`}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Monthly run cost</span>
        <span className="kpi-value">{money(monthly.atTarget, ctx, { compact: true })}</span>
        <span className="kpi-sub">
          {money(monthly.capitalCharge, ctx, { compact: true })} capex + {money(monthly.opexAtTarget, ctx, { compact: true })} opex
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Upfront capex</span>
        <span className="kpi-value">{money(totals.totalCapex, ctx, { compact: true })}</span>
        <span className="kpi-sub">{payback === null ? 'not paid back in term' : `cash payback in month ${payback}`}</span>
      </div>
    </div>
  )
}
