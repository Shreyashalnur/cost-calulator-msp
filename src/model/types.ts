// All money values in the model are stored in USD. The UI converts to the
// display currency (USD or INR) on the way in and out.

export type Currency = 'USD' | 'INR'

/** Drives which default discount applies to a quote line. */
export type LineCategory = 'hardware' | 'software' | 'support'

/** Marks the lines that add CPU, memory or storage capacity to a node. */
export type SpecKind = 'cpu' | 'dimm' | 'hdd' | 'ssd'

export interface ComponentSpec {
  kind: SpecKind
  /** Physical cores per CPU. */
  cores?: number
  /** GB per DIMM. */
  gb?: number
  /** Decimal TB per drive, as printed on the quote. */
  tb?: number
}

export interface BomLine {
  id: string
  sku: string
  description: string
  /**
   * Quantity. On a cluster line with `perNode`, this is the quantity per node;
   * otherwise it is the total quantity.
   */
  qty: number
  perNode?: boolean
  /** Unit list price in USD. */
  unitList: number
  category: LineCategory
  /** Overrides the category discount for this line when set. */
  discountPct?: number | null
  /** Service or subscription duration from the quote, in months. */
  termMonths?: number | null
  spec?: ComponentSpec
  /** Typical (not nameplate) power draw per unit, in watts. */
  watts?: number
  /** Rack units per unit. */
  rackUnits?: number
}

export type GroupKind = 'cluster' | 'network'
export type ClusterRole = 'production' | 'dr'

export interface BomGroup {
  id: string
  name: string
  kind: GroupKind
  /** Nodes in the cluster. Only used when kind === 'cluster'. */
  nodes?: number
  /** Production clusters host billable VMs. DR clusters add cost but no sellable capacity. */
  role?: ClusterRole
  note?: string
  lines: BomLine[]
}

export interface OneTimeItem {
  id: string
  name: string
  enabled: boolean
  /** fixed: qty × value. pctHardware: value % of net hardware spend. */
  mode: 'fixed' | 'pctHardware'
  qty: number
  value: number
  note?: string
}

export type OpexCategory = 'licensing' | 'people' | 'tools' | 'insurance' | 'other'

/**
 * fixed: qty × unit cost.
 * perCore: every physical core in the BOM × unit cost.
 * perVm: every sold VM × unit cost (a variable cost).
 * pctCapex: unit cost is a % of total capex per year.
 */
export type OpexDriver = 'fixed' | 'perCore' | 'perVm' | 'pctCapex'

export interface OpexItem {
  id: string
  name: string
  enabled: boolean
  category: OpexCategory
  driver: OpexDriver
  qty: number
  unitCost: number
  period: 'month' | 'year'
  note?: string
}

export interface Facility {
  /** null means work the rack count out from rack units and power. */
  racksOverride: number | null
  usableUPerRack: number
  maxKwPerRack: number
  rackFee: number
  powerMode: 'metered' | 'committed'
  /** null means use the typical draw summed from the BOM. */
  itLoadOverrideKw: number | null
  pue: number
  tariffPerKwh: number
  pricePerKwMonth: number
  crossConnects: number
  crossConnectFee: number
  remoteHands: number
  setupFee: number
  bandwidthMbps: number
  pricePerMbps: number
  publicIps: number
  pricePerIp: number
}

export interface CapacitySettings {
  /** vCPUs sold per physical core. */
  vcpuPerCore: number
  ramOvercommit: number
  /** Physical cores reserved per node for the Nutanix Controller VM. */
  cvmCores: number
  cvmRamGb: number
  hypervisorRamGb: number
  /** Hold back one node per cluster so VMs restart after a node failure. */
  haReserve: boolean
  /** Ceiling on how full the remaining capacity may run. */
  maxUtilPct: number
  replicationFactor: 2 | 3
  storageOverheadPct: number
  /** Compression / dedupe ratio, e.g. 1.2 means 1.2:1. */
  dataReduction: number
  /** Share of sellable capacity you expect to have sold at steady state. */
  targetOccupancyPct: number
}

export interface VmSize {
  id: string
  name: string
  vcpu: number
  ramGb: number
  storageGb: number
  /** Share of VMs sold at this size. */
  mixPct: number
}

export interface FinanceSettings {
  termMonths: number
  /** Annual rate used to turn capex into a monthly capital charge. */
  costOfCapitalPct: number
  /** Corporate overhead as a % of operating costs. */
  overheadPct: number
}

export type Resource = 'cpu' | 'ram' | 'storage'

export interface AddOn {
  id: string
  name: string
  unit: string
  cost: number
}

export interface PricingSettings {
  /** Gross margin on the 1-year commit price. */
  targetMarginPct: number
  weightMode: 'auto' | 'manual'
  weights: Record<Resource, number>
  paygUpliftPct: number
  threeYearDiscountPct: number
  rampStartPct: number
  rampMonths: number
  addOnMarginPct: number
  addOns: AddOn[]
}

export interface Model {
  version: number
  currency: Currency
  fxInrPerUsd: number
  discounts: Record<LineCategory, number>
  groups: BomGroup[]
  oneTime: OneTimeItem[]
  facility: Facility
  opex: OpexItem[]
  capacity: CapacitySettings
  vmSizes: VmSize[]
  finance: FinanceSettings
  pricing: PricingSettings
}
