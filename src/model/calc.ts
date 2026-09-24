import { irr, npv, pmt } from './finance'
import type {
  BomGroup,
  BomLine,
  ClusterRole,
  LineCategory,
  Model,
  OpexItem,
  Resource,
  VmSize,
} from './types'

export const RESOURCES: Resource[] = ['cpu', 'ram', 'storage']
export const HOURS_PER_MONTH = 730
/** Decimal TB (as drives are sold) to GiB (as capacity is presented). */
export const TB_TO_GIB = 1e12 / 2 ** 30

// ---------------------------------------------------------------------------
// Bill of materials
// ---------------------------------------------------------------------------

export function lineTotalQty(group: BomGroup, line: BomLine): number {
  return group.kind === 'cluster' && line.perNode ? line.qty * (group.nodes ?? 0) : line.qty
}

export function lineDiscountPct(model: Model, line: BomLine): number {
  return line.discountPct ?? model.discounts[line.category]
}

export function lineUnitNet(model: Model, line: BomLine): number {
  return line.unitList * (1 - lineDiscountPct(model, line) / 100)
}

export interface GroupCost {
  group: BomGroup
  list: number
  net: number
  byCategory: Record<LineCategory, number>
  watts: number
  rackUnits: number
}

function groupCost(model: Model, group: BomGroup): GroupCost {
  const byCategory: Record<LineCategory, number> = { hardware: 0, software: 0, support: 0 }
  let list = 0
  let watts = 0
  let rackUnits = 0
  for (const line of group.lines) {
    const q = lineTotalQty(group, line)
    list += q * line.unitList
    byCategory[line.category] += q * lineUnitNet(model, line)
    watts += q * (line.watts ?? 0)
    rackUnits += q * (line.rackUnits ?? 0)
  }
  const net = byCategory.hardware + byCategory.software + byCategory.support
  return { group, list, net, byCategory, watts, rackUnits }
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

export interface FunnelStep {
  label: string
  value: number
}

export interface ClusterCapacity {
  groupId: string
  name: string
  role: ClusterRole
  nodes: number
  usableNodes: number
  coresPerNode: number
  ramPerNodeGb: number
  ssdTb: number
  hddTb: number
  rawTb: number
  funnel: Record<Resource, FunnelStep[]>
  sellable: Record<Resource, number>
  /** How many average VMs each resource could hold on its own. */
  vmsBy: Record<Resource, number>
  /** Whole VMs this cluster can host. Zero for DR clusters. */
  maxVms: number
  /** Whole VMs the hardware could host, ignoring the cluster's role. */
  hostableVms: number
  binding: Resource | null
  /** Share of each sellable resource consumed when the cluster is full. */
  usedAtMax: Record<Resource, number>
}

export interface VmProfile {
  vcpu: number
  ramGb: number
  storageGb: number
}

export function averageVm(sizes: VmSize[]): VmProfile {
  const total = sizes.reduce((s, v) => s + Math.max(0, v.mixPct), 0)
  if (sizes.length === 0) return { vcpu: 0, ramGb: 0, storageGb: 0 }
  const w = (v: VmSize) => (total > 0 ? Math.max(0, v.mixPct) / total : 1 / sizes.length)
  return {
    vcpu: sizes.reduce((s, v) => s + w(v) * v.vcpu, 0),
    ramGb: sizes.reduce((s, v) => s + w(v) * v.ramGb, 0),
    storageGb: sizes.reduce((s, v) => s + w(v) * v.storageGb, 0),
  }
}

export function profileAmount(p: VmProfile, r: Resource): number {
  return r === 'cpu' ? p.vcpu : r === 'ram' ? p.ramGb : p.storageGb
}

function clusterCapacity(model: Model, group: BomGroup, avg: VmProfile): ClusterCapacity {
  const c = model.capacity
  const nodes = Math.max(0, group.nodes ?? 0)
  let cores = 0
  let ramGb = 0
  let ssdTb = 0
  let hddTb = 0
  for (const line of group.lines) {
    const q = lineTotalQty(group, line)
    const s = line.spec
    if (!s) continue
    if (s.kind === 'cpu') cores += q * (s.cores ?? 0)
    if (s.kind === 'dimm') ramGb += q * (s.gb ?? 0)
    if (s.kind === 'ssd') ssdTb += q * (s.tb ?? 0)
    if (s.kind === 'hdd') hddTb += q * (s.tb ?? 0)
  }
  const coresPerNode = nodes > 0 ? cores / nodes : 0
  const ramPerNodeGb = nodes > 0 ? ramGb / nodes : 0
  const usableNodes = c.haReserve ? Math.max(0, nodes - 1) : nodes
  const util = c.maxUtilPct / 100

  const coresAfterCvm = Math.max(0, coresPerNode - c.cvmCores)
  const cpu: FunnelStep[] = [
    { label: 'Physical cores', value: nodes * coresPerNode },
    { label: `After CVM reserve (${c.cvmCores} cores/node)`, value: nodes * coresAfterCvm },
    { label: c.haReserve ? 'After N+1 node reserve' : 'No N+1 reserve', value: usableNodes * coresAfterCvm },
    { label: `As vCPUs at ${c.vcpuPerCore}:1`, value: usableNodes * coresAfterCvm * c.vcpuPerCore },
    { label: `Sellable at ${c.maxUtilPct}% max load`, value: usableNodes * coresAfterCvm * c.vcpuPerCore * util },
  ]

  const ramAfterReserve = Math.max(0, ramPerNodeGb - c.cvmRamGb - c.hypervisorRamGb)
  const ram: FunnelStep[] = [
    { label: 'Installed memory (GB)', value: nodes * ramPerNodeGb },
    { label: `After CVM + AHV reserve (${c.cvmRamGb + c.hypervisorRamGb} GB/node)`, value: nodes * ramAfterReserve },
    { label: c.haReserve ? 'After N+1 node reserve' : 'No N+1 reserve', value: usableNodes * ramAfterReserve },
    { label: `At ${c.ramOvercommit}:1 memory overcommit`, value: usableNodes * ramAfterReserve * c.ramOvercommit },
    { label: `Sellable at ${c.maxUtilPct}% max load`, value: usableNodes * ramAfterReserve * c.ramOvercommit * util },
  ]

  const rawTb = ssdTb + hddTb
  const rawGib = rawTb * TB_TO_GIB
  const afterHa = nodes > 0 ? (rawGib * usableNodes) / nodes : 0
  const afterRf = afterHa / c.replicationFactor
  const afterOverhead = afterRf * (1 - c.storageOverheadPct / 100)
  const afterUtil = afterOverhead * util
  const storage: FunnelStep[] = [
    { label: `Raw drives (${fmtTb(rawTb)} TB)`, value: rawGib },
    { label: c.haReserve ? 'After N+1 rebuild reserve' : 'No rebuild reserve', value: afterHa },
    { label: `After RF${c.replicationFactor} replication`, value: afterRf },
    { label: `After ${c.storageOverheadPct}% system overhead`, value: afterOverhead },
    { label: `At ${c.maxUtilPct}% max fill`, value: afterUtil },
    { label: `Effective at ${c.dataReduction}:1 data reduction`, value: afterUtil * c.dataReduction },
  ]

  const funnel = { cpu, ram, storage }
  const sellable: Record<Resource, number> = {
    cpu: cpu[cpu.length - 1].value,
    ram: ram[ram.length - 1].value,
    storage: storage[storage.length - 1].value,
  }
  const vmsBy = {} as Record<Resource, number>
  for (const r of RESOURCES) {
    const need = profileAmount(avg, r)
    vmsBy[r] = need > 0 ? sellable[r] / need : Number.POSITIVE_INFINITY
  }
  let binding: Resource | null = null
  let fit = Number.POSITIVE_INFINITY
  for (const r of RESOURCES) {
    if (vmsBy[r] < fit) {
      fit = vmsBy[r]
      binding = r
    }
  }
  const hostableVms = Number.isFinite(fit) ? Math.floor(fit) : 0
  const role = group.role ?? 'production'
  const usedAtMax = {} as Record<Resource, number>
  for (const r of RESOURCES) {
    usedAtMax[r] = sellable[r] > 0 ? (hostableVms * profileAmount(avg, r)) / sellable[r] : 0
  }
  return {
    groupId: group.id,
    name: group.name,
    role,
    nodes,
    usableNodes,
    coresPerNode,
    ramPerNodeGb,
    ssdTb,
    hddTb,
    rawTb,
    funnel,
    sellable,
    vmsBy,
    maxVms: role === 'production' ? hostableVms : 0,
    hostableVms,
    binding,
    usedAtMax,
  }
}

function fmtTb(tb: number): string {
  return tb.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

export type CostKey =
  | 'computeHw'
  | 'networkHw'
  | 'supportSubs'
  | 'setup'
  | 'capital'
  | 'licensing'
  | 'colocation'
  | 'power'
  | 'connectivity'
  | 'people'
  | 'tools'
  | 'insurance'
  | 'overhead'

export interface CostLine {
  key: CostKey
  label: string
  kind: 'capex' | 'opex'
  monthly: number
  perVm: number | null
}

export const COST_LABELS: Record<CostKey, string> = {
  computeHw: 'Nutanix node hardware',
  networkHw: 'Network & security hardware',
  supportSubs: 'Cisco support & term subscriptions',
  setup: 'Setup, services & spares',
  capital: 'Cost of capital (financing)',
  licensing: 'Nutanix & software licences',
  colocation: 'Colocation space & services',
  power: 'Power & cooling',
  connectivity: 'Internet bandwidth & IPs',
  people: 'People (engineering & NOC)',
  tools: 'Tools & per-VM agents',
  insurance: 'Insurance, compliance & other',
  overhead: 'Corporate overhead',
}

export function opexItemMonthly(item: OpexItem, cores: number, totalCapex: number): number {
  const perPeriod = item.period === 'year' ? 1 / 12 : 1
  switch (item.driver) {
    case 'fixed':
      return item.qty * item.unitCost * perPeriod
    case 'perCore':
      return cores * item.unitCost * perPeriod
    case 'perVm':
      return item.unitCost * perPeriod
    case 'pctCapex':
      return (totalCapex * item.unitCost) / 100 / 12
  }
}

export interface CashflowMonth {
  month: number
  occupancyPct: number
  vms: number
  revenue: number
  opex: number
  capitalCharge: number
  profit: number
  cash: number
  cumulativeCash: number
  cumulativeProfit: number
}

export interface YearSummary {
  year: number
  endVms: number
  revenue: number
  opex: number
  capitalCharge: number
  profit: number
  cash: number
}

export interface SizePrice {
  size: VmSize
  cost: number
  price: number
  payg: number
  threeYear: number
  marginPayg: number
  marginOneYear: number
  marginThreeYear: number
}

export interface Results {
  groups: GroupCost[]
  clusters: ClusterCapacity[]
  avgVm: VmProfile
  totals: {
    physicalCores: number
    nodes: number
    itLoadKw: number
    itLoadAutoKw: number
    rackUnits: number
    racks: number
    racksAuto: number
    bomList: number
    bomNet: number
    hardwareNet: number
    softwareNet: number
    supportNet: number
    clusterHardwareNet: number
    networkHardwareNet: number
    oneTime: number
    totalCapex: number
  }
  monthly: {
    capitalCharge: number
    depreciation: number
    financing: number
    colocation: number
    power: number
    connectivity: number
    fixedOpex: number
    overheadFixed: number
    fixedTotal: number
    variablePerVm: number
    atTarget: number
    opexAtTarget: number
  }
  breakdown: CostLine[]
  vms: {
    max: number
    sold: number
    breakEven: number | null
    breakEvenOccupancyPct: number | null
  }
  unit: {
    costPerVm: number | null
    pricePerVm: number | null
    profitPerMonth: number
    weights: Record<Resource, number>
    autoWeights: Record<Resource, number>
    costRate: Record<Resource, number>
    priceRate: Record<Resource, number>
    variablePerVm: number
    sold: Record<Resource, number>
  }
  sizes: SizePrice[]
  curve: { occupancyPct: number; vms: number; costPerVm: number }[]
  cashflow: {
    months: CashflowMonth[]
    years: YearSummary[]
    paybackMonth: number | null
    npv: number
    irrAnnualPct: number | null
    totalRevenue: number
    totalProfit: number
  }
}

function normalise(w: Record<Resource, number>): Record<Resource, number> {
  const sum = RESOURCES.reduce((s, r) => s + Math.max(0, w[r]), 0)
  if (sum <= 0) return { cpu: 1 / 3, ram: 1 / 3, storage: 1 / 3 }
  return {
    cpu: Math.max(0, w.cpu) / sum,
    ram: Math.max(0, w.ram) / sum,
    storage: Math.max(0, w.storage) / sum,
  }
}

export function calculate(model: Model): Results {
  const { capacity: cap, facility: fac, finance, pricing } = model
  const term = Math.max(1, Math.round(finance.termMonths))
  const monthlyRate = finance.costOfCapitalPct / 100 / 12
  const oh = finance.overheadPct / 100
  const margin = Math.min(0.95, pricing.targetMarginPct / 100)
  const occupancy = Math.max(0, Math.min(1, cap.targetOccupancyPct / 100))

  // Bill of materials ------------------------------------------------------
  const groups = model.groups.map((g) => groupCost(model, g))
  const bomList = groups.reduce((s, g) => s + g.list, 0)
  const bomNet = groups.reduce((s, g) => s + g.net, 0)
  const hardwareNet = groups.reduce((s, g) => s + g.byCategory.hardware, 0)
  const softwareNet = groups.reduce((s, g) => s + g.byCategory.software, 0)
  const supportNet = groups.reduce((s, g) => s + g.byCategory.support, 0)
  const clusterHardwareNet = groups
    .filter((g) => g.group.kind === 'cluster')
    .reduce((s, g) => s + g.byCategory.hardware, 0)
  const networkHardwareNet = hardwareNet - clusterHardwareNet

  const oneTimeItems = model.oneTime
    .filter((i) => i.enabled)
    .reduce((s, i) => s + (i.mode === 'fixed' ? i.qty * i.value : (hardwareNet * i.value) / 100), 0)
  const oneTime = oneTimeItems + fac.setupFee
  const totalCapex = bomNet + oneTime

  // Capacity ----------------------------------------------------------------
  const avgVm = averageVm(model.vmSizes)
  const clusters = model.groups
    .filter((g) => g.kind === 'cluster')
    .map((g) => clusterCapacity(model, g, avgVm))
  const physicalCores = clusters.reduce((s, c) => s + c.nodes * c.coresPerNode, 0)
  const nodes = clusters.reduce((s, c) => s + c.nodes, 0)
  const maxVms = clusters.reduce((s, c) => s + c.maxVms, 0)
  const soldVms = maxVms * occupancy

  // Facility ----------------------------------------------------------------
  const itLoadAutoKw = groups.reduce((s, g) => s + g.watts, 0) / 1000
  const itLoadKw = fac.itLoadOverrideKw ?? itLoadAutoKw
  const rackUnits = groups.reduce((s, g) => s + g.rackUnits, 0)
  const racksAuto = Math.max(
    1,
    Math.ceil(rackUnits / Math.max(1, fac.usableUPerRack)),
    Math.ceil(itLoadKw / Math.max(0.1, fac.maxKwPerRack)),
  )
  const racks = fac.racksOverride ?? racksAuto

  // Monthly costs -----------------------------------------------------------
  const capitalCharge = pmt(monthlyRate, term, totalCapex)
  const depreciation = totalCapex / term
  const financing = capitalCharge - depreciation

  const colocation = racks * fac.rackFee + fac.crossConnects * fac.crossConnectFee + fac.remoteHands
  const power =
    fac.powerMode === 'metered'
      ? itLoadKw * HOURS_PER_MONTH * fac.pue * fac.tariffPerKwh
      : itLoadKw * fac.pricePerKwMonth
  const connectivity = fac.bandwidthMbps * fac.pricePerMbps + fac.publicIps * fac.pricePerIp

  const itemCost: Record<'licensing' | 'people' | 'tools' | 'insurance', { fixed: number; perVm: number }> = {
    licensing: { fixed: 0, perVm: 0 },
    people: { fixed: 0, perVm: 0 },
    tools: { fixed: 0, perVm: 0 },
    insurance: { fixed: 0, perVm: 0 },
  }
  let perCoreMonthly = 0
  for (const item of model.opex) {
    if (!item.enabled) continue
    const amount = opexItemMonthly(item, physicalCores, totalCapex)
    const bucket = item.category === 'other' ? 'insurance' : item.category
    if (item.driver === 'perVm') itemCost[bucket].perVm += amount
    else itemCost[bucket].fixed += amount
    if (item.driver === 'perCore') perCoreMonthly += amount
  }
  const fixedItems = Object.values(itemCost).reduce((s, v) => s + v.fixed, 0)
  const variableRaw = Object.values(itemCost).reduce((s, v) => s + v.perVm, 0)
  const fixedOpex = colocation + power + connectivity + fixedItems
  const overheadFixed = fixedOpex * oh
  const fixedTotal = capitalCharge + fixedOpex + overheadFixed
  const variablePerVm = variableRaw * (1 + oh)
  const monthlyAt = (vms: number) => fixedTotal + variablePerVm * vms
  const atTarget = monthlyAt(soldVms)

  // Breakdown ---------------------------------------------------------------
  const perVm = (m: number) => (soldVms > 0 ? m / soldVms : null)
  const amort = (amount: number) => amount / term
  const raw: [CostKey, 'capex' | 'opex', number][] = [
    ['computeHw', 'capex', amort(clusterHardwareNet)],
    ['networkHw', 'capex', amort(networkHardwareNet)],
    ['supportSubs', 'capex', amort(softwareNet + supportNet)],
    ['setup', 'capex', amort(oneTime)],
    ['capital', 'capex', financing],
    ['licensing', 'opex', itemCost.licensing.fixed + itemCost.licensing.perVm * soldVms],
    ['colocation', 'opex', colocation],
    ['power', 'opex', power],
    ['connectivity', 'opex', connectivity],
    ['people', 'opex', itemCost.people.fixed + itemCost.people.perVm * soldVms],
    ['tools', 'opex', itemCost.tools.fixed + itemCost.tools.perVm * soldVms],
    ['insurance', 'opex', itemCost.insurance.fixed + itemCost.insurance.perVm * soldVms],
    ['overhead', 'opex', overheadFixed + variableRaw * oh * soldVms],
  ]
  const breakdown: CostLine[] = raw.map(([key, kind, monthly]) => ({
    key,
    label: COST_LABELS[key],
    kind,
    monthly,
    perVm: perVm(monthly),
  }))

  // Unit economics ----------------------------------------------------------
  const costPerVm = soldVms > 0 ? atTarget / soldVms : null
  const pricePerVm = costPerVm === null ? null : costPerVm / (1 - margin)
  const breakEven =
    pricePerVm !== null && pricePerVm > variablePerVm ? fixedTotal / (pricePerVm - variablePerVm) : null
  const breakEvenOccupancyPct = breakEven !== null && maxVms > 0 ? (breakEven / maxVms) * 100 : null

  // Resource-driven split of shared cost: each resource's own spend.
  const cpuDirect = sumSpec(model, 'cpu') / term + perCoreMonthly
  const ramDirect = sumSpec(model, 'dimm') / term
  const storageDirect = (sumSpec(model, 'hdd') + sumSpec(model, 'ssd')) / term
  const autoWeights = normalise({ cpu: cpuDirect, ram: ramDirect, storage: storageDirect })
  const weights = pricing.weightMode === 'auto' ? autoWeights : normalise(pricing.weights)

  const sold: Record<Resource, number> = {
    cpu: soldVms * avgVm.vcpu,
    ram: soldVms * avgVm.ramGb,
    storage: soldVms * avgVm.storageGb,
  }
  const costRate = {} as Record<Resource, number>
  const priceRate = {} as Record<Resource, number>
  for (const r of RESOURCES) {
    costRate[r] = sold[r] > 0 ? (fixedTotal * weights[r]) / sold[r] : 0
    priceRate[r] = costRate[r] / (1 - margin)
  }

  const sizes: SizePrice[] = model.vmSizes.map((size) => {
    const cost =
      size.vcpu * costRate.cpu + size.ramGb * costRate.ram + size.storageGb * costRate.storage + variablePerVm
    const price = cost / (1 - margin)
    const payg = price * (1 + pricing.paygUpliftPct / 100)
    const threeYear = price * (1 - pricing.threeYearDiscountPct / 100)
    const m = (p: number) => (p > 0 ? 1 - cost / p : 0)
    return {
      size,
      cost,
      price,
      payg,
      threeYear,
      marginPayg: m(payg),
      marginOneYear: m(price),
      marginThreeYear: m(threeYear),
    }
  })

  const curve: Results['curve'] = []
  for (let pct = 5; pct <= 100; pct += 5) {
    const vms = maxVms * (pct / 100)
    if (vms <= 0) continue
    curve.push({ occupancyPct: pct, vms, costPerVm: monthlyAt(vms) / vms })
  }

  // Cash flow ---------------------------------------------------------------
  const start = Math.min(occupancy, Math.max(0, pricing.rampStartPct / 100))
  const rampMonths = Math.max(1, Math.round(pricing.rampMonths))
  const months: CashflowMonth[] = [
    {
      month: 0,
      occupancyPct: 0,
      vms: 0,
      revenue: 0,
      opex: 0,
      capitalCharge: 0,
      profit: 0,
      cash: -totalCapex,
      cumulativeCash: -totalCapex,
      cumulativeProfit: 0,
    },
  ]
  let cumCash = -totalCapex
  let cumProfit = 0
  let paybackMonth: number | null = null
  const price = pricePerVm ?? 0
  const opexFixedWithOh = fixedOpex + overheadFixed
  for (let t = 1; t <= term; t++) {
    const progress = rampMonths <= 1 ? 1 : Math.min(1, (t - 1) / (rampMonths - 1))
    const occ = start + (occupancy - start) * progress
    const vms = maxVms * occ
    const revenue = vms * price
    const opex = opexFixedWithOh + variablePerVm * vms
    const cash = revenue - opex
    const profit = revenue - opex - capitalCharge
    cumCash += cash
    cumProfit += profit
    if (paybackMonth === null && cumCash >= 0) paybackMonth = t
    months.push({
      month: t,
      occupancyPct: occ * 100,
      vms,
      revenue,
      opex,
      capitalCharge,
      profit,
      cash,
      cumulativeCash: cumCash,
      cumulativeProfit: cumProfit,
    })
  }
  const years: YearSummary[] = []
  for (let y = 1; y <= Math.ceil(term / 12); y++) {
    const slice = months.filter((m) => m.month > (y - 1) * 12 && m.month <= y * 12)
    years.push({
      year: y,
      endVms: slice.length ? slice[slice.length - 1].vms : 0,
      revenue: slice.reduce((s, m) => s + m.revenue, 0),
      opex: slice.reduce((s, m) => s + m.opex, 0),
      capitalCharge: slice.reduce((s, m) => s + m.capitalCharge, 0),
      profit: slice.reduce((s, m) => s + m.profit, 0),
      cash: slice.reduce((s, m) => s + m.cash, 0),
    })
  }
  const flows = months.map((m) => m.cash)
  const monthlyIrr = irr(flows)

  return {
    groups,
    clusters,
    avgVm,
    totals: {
      physicalCores,
      nodes,
      itLoadKw,
      itLoadAutoKw,
      rackUnits,
      racks,
      racksAuto,
      bomList,
      bomNet,
      hardwareNet,
      softwareNet,
      supportNet,
      clusterHardwareNet,
      networkHardwareNet,
      oneTime,
      totalCapex,
    },
    monthly: {
      capitalCharge,
      depreciation,
      financing,
      colocation,
      power,
      connectivity,
      fixedOpex,
      overheadFixed,
      fixedTotal,
      variablePerVm,
      atTarget,
      opexAtTarget: atTarget - capitalCharge,
    },
    breakdown,
    vms: { max: maxVms, sold: soldVms, breakEven, breakEvenOccupancyPct },
    unit: {
      costPerVm,
      pricePerVm,
      profitPerMonth: pricePerVm === null ? 0 : soldVms * pricePerVm - atTarget,
      weights,
      autoWeights,
      costRate,
      priceRate,
      variablePerVm,
      sold,
    },
    sizes,
    curve,
    cashflow: {
      months,
      years,
      paybackMonth,
      npv: npv(monthlyRate, flows),
      irrAnnualPct: monthlyIrr === null ? null : (Math.pow(1 + monthlyIrr, 12) - 1) * 100,
      totalRevenue: months.reduce((s, m) => s + m.revenue, 0),
      totalProfit: cumProfit,
    },
  }
}

/** Net spend on lines of one component kind, across every cluster. */
function sumSpec(model: Model, kind: 'cpu' | 'dimm' | 'hdd' | 'ssd'): number {
  let total = 0
  for (const g of model.groups) {
    for (const line of g.lines) {
      if (line.spec?.kind === kind) total += lineTotalQty(g, line) * lineUnitNet(model, line)
    }
  }
  return total
}
