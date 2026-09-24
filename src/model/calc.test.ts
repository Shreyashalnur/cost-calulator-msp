import { describe, expect, it } from 'vitest'
import { averageVm, calculate, TB_TO_GIB } from './calc'
import { defaultModel } from './defaults'
import { irr, npv, pmt } from './finance'
import type { Model } from './types'

function model(patch: (m: Model) => void = () => {}): Model {
  const m = defaultModel()
  patch(m)
  return m
}

describe('finance helpers', () => {
  it('pmt falls back to straight line at zero interest', () => {
    expect(pmt(0, 60, 6000)).toBe(100)
  })

  it('pmt matches the annuity formula', () => {
    // 100,000 over 60 months at 10% a year is about 2,124.70 a month.
    expect(pmt(0.1 / 12, 60, 100_000)).toBeCloseTo(2124.7, 1)
  })

  it('irr recovers the rate that zeroes npv', () => {
    const flows = [-1000, 300, 300, 300, 300]
    const r = irr(flows)
    expect(r).not.toBeNull()
    expect(npv(r!, flows)).toBeCloseTo(0, 4)
  })

  it('irr is null when flows never turn positive', () => {
    expect(irr([-100, -10, -10])).toBeNull()
  })
})

describe('capacity from the supplied BOM', () => {
  const r = calculate(defaultModel())
  const [c1, c2] = r.clusters

  it('reads node specs off the quote lines', () => {
    expect(r.totals.nodes).toBe(6)
    expect(r.totals.physicalCores).toBe(288)
    expect(c1.coresPerNode).toBe(48)
    expect(c1.ramPerNodeGb).toBe(1024)
    expect(c2.ramPerNodeGb).toBe(512)
    expect(c1.hddTb).toBe(192)
    expect(c2.hddTb).toBe(288)
    expect(c1.ssdTb).toBeCloseTo(23.04)
  })

  it('applies CVM, N+1, overcommit and load ceiling to vCPU', () => {
    // 2 usable nodes × (48 − 8) cores × 4 vCPU/core × 90%
    expect(c1.sellable.cpu).toBeCloseTo(288)
  })

  it('applies reserves to memory', () => {
    // 2 usable nodes × (1024 − 40) GB × 90%
    expect(c1.sellable.ram).toBeCloseTo(1771.2)
    expect(c2.sellable.ram).toBeCloseTo(849.6)
  })

  it('applies rebuild reserve, RF2, overhead, fill and data reduction to storage', () => {
    const expected = c1.rawTb * TB_TO_GIB * (2 / 3) * 0.5 * 0.95 * 0.9 * 1.2
    expect(c1.sellable.storage).toBeCloseTo(expected)
  })

  it('finds the binding resource per cluster', () => {
    expect(c1.binding).toBe('cpu')
    expect(c2.binding).toBe('ram')
    const avg = averageVm(defaultModel().vmSizes)
    expect(c1.maxVms).toBe(Math.floor(288 / avg.vcpu))
    expect(c2.maxVms).toBe(Math.floor(849.6 / avg.ramGb))
  })

  it('removes a DR cluster from sellable capacity but keeps its cost', () => {
    const dr = calculate(model((m) => (m.groups[1].role = 'dr')))
    expect(dr.vms.max).toBe(c1.maxVms)
    expect(dr.totals.totalCapex).toBeCloseTo(r.totals.totalCapex)
  })

  it('scales per-node lines with the node count', () => {
    const bigger = calculate(model((m) => (m.groups[0].nodes = 4)))
    expect(bigger.clusters[0].nodes).toBe(4)
    expect(bigger.totals.physicalCores).toBe(336)
    expect(bigger.clusters[0].maxVms).toBeGreaterThan(c1.maxVms)
    expect(bigger.totals.bomNet).toBeGreaterThan(r.totals.bomNet)
  })

  it('returns zero capacity rather than NaN for a one-node cluster with N+1', () => {
    const tiny = calculate(model((m) => (m.groups[0].nodes = 1)))
    expect(tiny.clusters[0].maxVms).toBe(0)
    expect(Number.isNaN(tiny.clusters[0].sellable.storage)).toBe(false)
  })
})

describe('costs and pricing', () => {
  const r = calculate(defaultModel())

  it('breakdown adds up to the monthly cost at target occupancy', () => {
    const sum = r.breakdown.reduce((s, b) => s + b.monthly, 0)
    expect(sum).toBeCloseTo(r.monthly.atTarget, 6)
  })

  it('capital charge covers depreciation plus financing', () => {
    expect(r.monthly.depreciation + r.monthly.financing).toBeCloseTo(r.monthly.capitalCharge, 6)
    expect(r.monthly.depreciation).toBeCloseTo(r.totals.totalCapex / 60, 6)
  })

  it('prices the average VM at cost ÷ (1 − margin)', () => {
    expect(r.unit.pricePerVm).toBeCloseTo(r.unit.costPerVm! / 0.65, 6)
  })

  it('unit rates recover the full monthly cost for the planned mix', () => {
    const m = defaultModel()
    const totalMix = m.vmSizes.reduce((s, v) => s + v.mixPct, 0)
    const recovered = r.sizes.reduce(
      (s, p) => s + p.cost * r.vms.sold * (p.size.mixPct / totalMix),
      0,
    )
    expect(recovered).toBeCloseTo(r.monthly.atTarget, 4)
  })

  it('break-even VM count makes revenue equal cost', () => {
    const be = r.vms.breakEven!
    const cost = r.monthly.fixedTotal + r.monthly.variablePerVm * be
    expect(be * r.unit.pricePerVm!).toBeCloseTo(cost, 6)
  })

  it('cost per VM falls as occupancy rises', () => {
    for (let i = 1; i < r.curve.length; i++) {
      expect(r.curve[i].costPerVm).toBeLessThan(r.curve[i - 1].costPerVm)
    }
  })

  it('term pricing keeps PAYG above and 3-year below the 1-year price', () => {
    for (const s of r.sizes) {
      expect(s.payg).toBeGreaterThan(s.price)
      expect(s.threeYear).toBeLessThan(s.price)
      expect(s.marginOneYear).toBeCloseTo(0.35, 6)
    }
  })

  it('cash flow starts with the full capex outlay', () => {
    expect(r.cashflow.months[0].cash).toBeCloseTo(-r.totals.totalCapex, 6)
    expect(r.cashflow.months).toHaveLength(61)
    expect(r.cashflow.years).toHaveLength(5)
  })

  it('switching power to committed kW uses the per-kW price', () => {
    const c = calculate(model((m) => (m.facility.powerMode = 'committed')))
    expect(c.monthly.power).toBeCloseTo(c.totals.itLoadKw * 130, 6)
  })

  it('per-core licences follow the core count', () => {
    const on = calculate(model((m) => (m.opex.find((o) => o.id === 'op-spla')!.enabled = true)))
    expect(on.monthly.fixedOpex - r.monthly.fixedOpex).toBeCloseTo(288 * 15, 6)
  })
})
