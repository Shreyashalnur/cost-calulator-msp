import type { BomGroup, BomLine, Model } from './types'

// Unit list prices below are indicative placeholders in USD, not a Cisco
// quote. SKUs and quantities follow the supplied bill of materials. Replace
// the prices with the net figures from your own quote.

export const MODEL_VERSION = 3

type LineInput = Omit<BomLine, 'id'>

function lines(groupId: string, input: LineInput[]): BomLine[] {
  return input.map((l, i) => ({ id: `${groupId}-${i + 1}`, ...l }))
}

/** One Cisco Compute Hyperconverged HCI 240c M8 LFF Nutanix cluster. */
function cluster(
  id: string,
  name: string,
  note: string,
  dimmsPerNode: number,
  hddsPerNode: number,
): BomGroup {
  return {
    id,
    name,
    kind: 'cluster',
    nodes: 3,
    role: 'production',
    note,
    lines: lines(id, [
      { sku: 'HCI-M8-NTNX-MLB', description: 'Cisco Compute Hyperconverged & Compute-Only M8 Nutanix MLB', qty: 1, unitList: 0, category: 'hardware' },
      { sku: 'DC-MGT-SAAS', description: 'Cisco Intersight SaaS', qty: 1, unitList: 0, category: 'software' },
      { sku: 'SAAS-OTHER', description: 'Other Use Case', qty: 1, unitList: 0, category: 'software' },
      { sku: 'DC-MGT-IS-SAAS-ES', description: 'Infrastructure Services SaaS/CVA - Essentials', qty: 1, perNode: true, unitList: 850, category: 'software', termMonths: 60 },
      { sku: 'SVS-DCM-SUPT-BAS', description: 'Cisco Support Basic for DCM', qty: 1, unitList: 0, category: 'support', termMonths: 60 },
      { sku: 'DC-MGT-UCSC-1S', description: 'UCS Central Per Server - 1 Server License', qty: 1, perNode: true, unitList: 0, category: 'software', termMonths: 60 },
      { sku: 'HCINX240C-M8L', description: 'Cisco Compute Hyperconverged HCI 240cM8 LFF Nutanix Node', qty: 1, perNode: true, unitList: 9200, category: 'hardware', watts: 180, rackUnits: 2 },
      { sku: 'CON-SNTP-HCIN2M8L', description: 'SNTC-24X7X4 Cisco Compute Hyperconverged HCI 240cM8', qty: 1, perNode: true, unitList: 8800, category: 'support', termMonths: 60 },
      { sku: 'NTNX-HCI', description: 'Nutanix HCI Use Case', qty: 1, perNode: true, unitList: 0, category: 'hardware' },
      { sku: 'HCI-IS-MANAGED', description: 'Deployment mode for Standalone Server Managed by Intersight', qty: 1, perNode: true, unitList: 0, category: 'hardware' },
      { sku: 'HCI-MRX64G2RE5', description: '64GB DDR5-6400 RDIMM 2Rx4 (16Gb)', qty: dimmsPerNode, perNode: true, unitList: 3400, category: 'hardware', spec: { kind: 'dimm', gb: 64 }, watts: 6 },
      { sku: 'HCI-HBAMP1LL32', description: '24G Tri-Mode M1 HBA for 32 LFF Drives', qty: 1, perNode: true, unitList: 1450, category: 'hardware', watts: 15 },
      { sku: 'HCI-HDL16TT2S74K', description: '16TB 3.5in 12G SAS 7.2K RPM 4K Front Load Toshiba HDD', qty: hddsPerNode, perNode: true, unitList: 1650, category: 'hardware', spec: { kind: 'hdd', tb: 16 }, watts: 9 },
      { sku: 'HCI-SD38TKA1X-EV', description: '3.8TB 2.5in Enter Value 24G SAS Kioxia PM7 SSD (1X)', qty: 2, perNode: true, unitList: 3900, category: 'hardware', spec: { kind: 'ssd', tb: 3.84 }, watts: 9 },
      { sku: 'HCI-M2-480G', description: '480GB M.2 SATA SSD', qty: 2, perNode: true, unitList: 650, category: 'hardware', watts: 2 },
      { sku: 'HCI-M2-HWRAID2', description: 'Cisco Boot optimized M.2 Raid controller for SATA drives', qty: 1, perNode: true, unitList: 480, category: 'hardware' },
      { sku: 'HCI-RAIL-M7', description: 'Ball Bearing Rail Kit for C220 & C240 M7/M8 rack servers', qty: 1, perNode: true, unitList: 180, category: 'hardware' },
      { sku: 'HCI-TPM-002D', description: 'TPM 2.0 TCG FIPS140-2 CC+ Cert M7 Intel MSW2022 Compliant', qty: 1, perNode: true, unitList: 120, category: 'hardware' },
      { sku: 'HCI-AOSAHV-75-SWK9', description: 'HCI AOS AHV 7.5 SW', qty: 1, perNode: true, unitList: 0, category: 'software' },
      { sku: 'HCI-CPU-I6527P', description: 'Intel I6527P 3.0GHz/255W 24C/144MB DDR5 6400MT/s', qty: 2, perNode: true, unitList: 6900, category: 'hardware', spec: { kind: 'cpu', cores: 24 }, watts: 170 },
      { sku: 'HCI-RIS1B-240M8', description: 'HCI C240 M8 Riser 1B support 2xSFF drives', qty: 1, perNode: true, unitList: 280, category: 'hardware' },
      { sku: 'HCI-RIS2A-240M8', description: 'HCI C240 M8 Riser 2A PCIe Gen5 (x8, x16, x8) (CPU2)', qty: 1, perNode: true, unitList: 320, category: 'hardware' },
      { sku: 'HCI-PCIE', description: 'Third Party NIC Connectivity', qty: 1, perNode: true, unitList: 0, category: 'hardware' },
      { sku: 'HCI-P-ID10GC', description: 'Cisco-Intel X710T2LG 2x10 GbE RJ45 PCIe NIC', qty: 1, perNode: true, unitList: 780, category: 'hardware', watts: 10 },
      { sku: 'HCI-P-I8D25GF', description: 'Cisco-Intel E810XXVDA2 2x25/10 GbE SFP28 PCIe NIC', qty: 1, perNode: true, unitList: 1150, category: 'hardware', watts: 12 },
      { sku: 'HCI-P-I8D25GF', description: 'Cisco-Intel E810XXVDA2 2x25/10 GbE SFP28 PCIe NIC', qty: 1, perNode: true, unitList: 1150, category: 'hardware', watts: 12 },
      { sku: 'HCI-PSU1-1600W', description: 'UCS 1600W AC PSU Platinum (Not EU/UK Lot 9 Compliant)', qty: 2, perNode: true, unitList: 950, category: 'hardware' },
      { sku: 'CAB-250V-10A-ID', description: 'AC Power Cord - 250V, 10A, India', qty: 2, perNode: true, unitList: 0, category: 'hardware' },
      { sku: 'SFP-H25G-CU5M=', description: '25GBASE-CU SFP28 Cable 5 Meter', qty: 2, perNode: true, unitList: 480, category: 'hardware' },
    ]),
  }
}

function accessStack(id: string, name: string): BomGroup {
  return {
    id,
    name,
    kind: 'network',
    note: 'Catalyst 9300 pair with 8×10G uplink modules and 5-year DNA Advantage.',
    lines: lines(id, [
      { sku: 'C9300-24T-A', description: 'Catalyst 9300 24-port data only, Network Advantage', qty: 2, unitList: 7200, category: 'hardware', watts: 90, rackUnits: 1 },
      { sku: 'CON-SNTP-C93002TA', description: 'SNTC-24X7X4 Catalyst 9300 24-port data only, Network', qty: 2, unitList: 3300, category: 'support', termMonths: 60 },
      { sku: 'C9300-SSD-NONE', description: 'No SSD Card Selected', qty: 2, unitList: 0, category: 'hardware' },
      { sku: 'D-DNAS-EXT-S-5Y', description: 'Cisco DNA Spaces Extend for Catalyst Switching - 5Year', qty: 2, unitList: 0, category: 'software', termMonths: 60 },
      { sku: 'CAB-TA-IN', description: 'India AC Type A Power Cable', qty: 4, unitList: 0, category: 'hardware' },
      { sku: 'C9300-SPWR-NONE', description: 'No Stack Power Cable Selected', qty: 2, unitList: 0, category: 'hardware' },
      { sku: 'STACK-T1-50CM', description: '50CM Type 1 Stacking Cable', qty: 2, unitList: 0, category: 'hardware' },
      { sku: 'C9300-DNA-A-24', description: 'C9300 DNA Advantage, 24-port Term Licenses', qty: 2, unitList: 0, category: 'software' },
      { sku: 'C9300-DNA-A-24-5Y', description: 'C9300 DNA Advantage, 24-Port, 5 Year Term License', qty: 2, unitList: 3600, category: 'software', termMonths: 60 },
      { sku: 'TE-EMBEDDED-T-5Y', description: 'ThousandEyes - Enterprise Agents', qty: 2, unitList: 0, category: 'software', termMonths: 60 },
      { sku: 'PWR-C1-350WAC-P/2', description: '350W AC 80+ platinum Config 1 Secondary Power Supply', qty: 2, unitList: 950, category: 'hardware' },
      { sku: 'C9300-NM-8X', description: 'Catalyst 9300 8 x 10GE Network Module', qty: 2, unitList: 3900, category: 'hardware', watts: 25 },
      { sku: 'C9K-ACC-RBFT', description: 'Rubber feet for table top setup 9200 and 93xx', qty: 2, unitList: 0, category: 'hardware' },
      { sku: 'C9K-ACC-SCR-4', description: '12-24 and 10-32 screws for rack installation, qty 4', qty: 2, unitList: 0, category: 'hardware' },
      { sku: 'CAB-GUIDE-1RU', description: '1RU cable management guides 9200 and 9300', qty: 2, unitList: 0, category: 'hardware' },
    ]),
  }
}

export function defaultGroups(): BomGroup[] {
  return [
    cluster(
      'ntnx-1',
      'Nutanix cluster 1 · memory-dense',
      '3 × HCI 240c M8 LFF: 2 × Xeon 6527P (24C), 16 × 64 GB (1 TB), 4 × 16 TB HDD + 2 × 3.84 TB SSD per node.',
      16,
      4,
    ),
    cluster(
      'ntnx-2',
      'Nutanix cluster 2 · storage-dense',
      '3 × HCI 240c M8 LFF: 2 × Xeon 6527P (24C), 8 × 64 GB (512 GB), 6 × 16 TB HDD + 2 × 3.84 TB SSD per node.',
      8,
      6,
    ),
    {
      id: 'fw',
      name: 'Perimeter security · Secure Firewall 3130 HA',
      kind: 'network',
      note: 'Active/standby FTD pair with 5-year Threat + Malware subscription and virtual FMC.',
      lines: lines('fw', [
        { sku: 'FPR3100-FTD-HA-BUN', description: 'Cisco Secure Firewall 3K Threat Defense Chss, Subs HA Bundle', qty: 1, unitList: 0, category: 'hardware' },
        { sku: 'FPR3130-NGFW-K9', description: 'Cisco Secure Firewall 3130 NGFW Appliance, 1U', qty: 2, unitList: 52000, category: 'hardware', watts: 250, rackUnits: 1 },
        { sku: 'CON-SNTP-FPR3130N', description: 'SNTC-24X7X4 Cisco Secure Firewall 3130 NGFW Appliance', qty: 2, unitList: 22000, category: 'support', termMonths: 60 },
        { sku: 'CAB-C13-C14-IN', description: 'Power Cord Jumper, C13-C14 Connectors, 1.4 Meter, India', qty: 4, unitList: 0, category: 'hardware' },
        { sku: 'L-FPR3130T-TM=', description: 'Cisco Secure Firewall 3130 Threat Defence and AMP License', qty: 2, unitList: 0, category: 'software' },
        { sku: 'CON-L1SWT-FPR3130M', description: 'ENH SW SUB Cisco Secure Firewall', qty: 2, unitList: 0, category: 'support', termMonths: 60 },
        { sku: 'L-FPR3130T-TM-5Y', description: 'Cisco Secure Firewall 3130 Threat Defence and AMP 5Y Subs', qty: 2, unitList: 55000, category: 'software', termMonths: 60 },
        { sku: 'SF-FMC-VMW-2-K9', description: 'Cisco Firepower Management Center (VMware) for 2 devices', qty: 1, unitList: 3000, category: 'software' },
        { sku: 'CON-L1SW-SFMMCVWK', description: 'ENH SW Cisco Firepower Management Center', qty: 1, unitList: 1400, category: 'support', termMonths: 60 },
      ]),
    },
    {
      id: 'core',
      name: 'DC core switching · Catalyst 9500',
      kind: 'network',
      note: 'Catalyst 9500 24×25G + 4×100G pair with optics and DAC/AOC cabling.',
      lines: lines('core', [
        { sku: 'C9500-24Y4C-A', description: 'Catalyst 9500 24x1/10/25G and 4-port 40/100G, Advantage', qty: 2, unitList: 32000, category: 'hardware', watts: 280, rackUnits: 1 },
        { sku: 'CON-SNTP-C95024YA', description: 'SNTC-24X7X4 Catalyst 9500 24-port 25/100G only, Advantage', qty: 2, unitList: 13500, category: 'support', termMonths: 60 },
        { sku: 'C9500-DNA-24Y4C-A', description: 'C9500 DNA Advantage, Term License', qty: 2, unitList: 0, category: 'software' },
        { sku: 'C9500-DNA-L-A-5Y', description: 'DNA Advantage 5 Year License', qty: 2, unitList: 11000, category: 'software', termMonths: 60 },
        { sku: 'CAB-IND-10A', description: '10A Power cable for India', qty: 4, unitList: 0, category: 'hardware' },
        { sku: 'C9K-PWR-650WAC-R/2', description: '650W AC Config 4 Power Supply front to back cooling', qty: 2, unitList: 1600, category: 'hardware' },
        { sku: 'C9500-SSD-NONE', description: 'No SSD Card Selected', qty: 2, unitList: 0, category: 'hardware' },
        { sku: 'C9500-RFID-NONE', description: 'No RFID Selected', qty: 2, unitList: 0, category: 'hardware' },
        { sku: 'SFP-10G-SR-S=', description: '10GBASE-SR SFP Module, Enterprise-Class', qty: 22, unitList: 690, category: 'hardware' },
        { sku: 'SFP-H25G-CU5M=', description: '25GBASE-CU SFP28 Cable 5 Meter', qty: 16, unitList: 480, category: 'hardware' },
        { sku: 'SFP-H10GB-CU5M=', description: '10GBASE-CU SFP+ Cable 5 Meter', qty: 10, unitList: 300, category: 'hardware' },
        { sku: 'QSFP-100G-AOC5M=', description: '100GBASE QSFP Active Optical Cable, 5m', qty: 4, unitList: 1150, category: 'hardware' },
      ]),
    },
    accessStack('access-1', 'Access & management switching · Catalyst 9300 stack A'),
    accessStack('access-2', 'Access & management switching · Catalyst 9300 stack B'),
  ]
}

export function defaultModel(): Model {
  return {
    version: MODEL_VERSION,
    currency: 'INR',
    fxInrPerUsd: 88,
    discounts: { hardware: 55, software: 45, support: 40 },
    groups: defaultGroups(),
    oneTime: [
      { id: 'ot-ps', name: 'Deployment & professional services (Foundation, network build, handover)', enabled: true, mode: 'fixed', qty: 1, value: 14000 },
      { id: 'ot-pdu', name: 'Intelligent metered PDUs (2 per rack)', enabled: true, mode: 'fixed', qty: 4, value: 1100 },
      { id: 'ot-cabling', name: 'Structured cabling, patch panels & cable management', enabled: true, mode: 'fixed', qty: 1, value: 2500 },
      { id: 'ot-oob', name: 'Console server for out-of-band access', enabled: true, mode: 'fixed', qty: 1, value: 1800 },
      { id: 'ot-freight', name: 'Freight, logistics & transit insurance', enabled: true, mode: 'pctHardware', qty: 1, value: 1.5 },
      { id: 'ot-spares', name: 'Critical spares kit (HDD, SSD, PSU, optics)', enabled: true, mode: 'fixed', qty: 1, value: 4500 },
    ],
    facility: {
      racksOverride: null,
      usableUPerRack: 38,
      maxKwPerRack: 5,
      rackFee: 450,
      powerMode: 'metered',
      itLoadOverrideKw: null,
      pue: 1.5,
      tariffPerKwh: 0.12,
      pricePerKwMonth: 130,
      crossConnects: 2,
      crossConnectFee: 120,
      remoteHands: 150,
      setupFee: 1000,
      bandwidthMbps: 500,
      pricePerMbps: 2.5,
      publicIps: 64,
      pricePerIp: 0.6,
    },
    opex: [
      { id: 'op-ntnx', name: 'Nutanix Cloud Infrastructure (NCI Pro) subscription', enabled: true, category: 'licensing', driver: 'perCore', qty: 1, unitCost: 190, period: 'year', note: 'Per physical core. The BOM carries AOS/AHV media only, not Nutanix licences.' },
      { id: 'op-ncm', name: 'Nutanix Cloud Manager (tenant self-service portal)', enabled: false, category: 'licensing', driver: 'perCore', qty: 1, unitCost: 80, period: 'year', note: 'Turn on if tenants get a self-service portal.' },
      { id: 'op-spla', name: 'Microsoft SPLA Windows Server Datacenter (all host cores)', enabled: false, category: 'licensing', driver: 'perCore', qty: 1, unitCost: 15, period: 'month', note: 'Priced per core, so half the 2-core pack price. Covers unlimited Windows guests; many MSPs bill it per VM instead.' },
      { id: 'op-noc', name: 'NOC 24×7 monitoring (shared pool)', enabled: true, category: 'people', driver: 'fixed', qty: 0.5, unitCost: 14000, period: 'year', note: 'Quantity is FTE allocated to this platform. Cost is fully loaded per year.' },
      { id: 'op-l2', name: 'Cloud platform engineer (Nutanix / L2)', enabled: true, category: 'people', driver: 'fixed', qty: 1, unitCost: 22000, period: 'year' },
      { id: 'op-net', name: 'Network & security engineer (L2/L3)', enabled: true, category: 'people', driver: 'fixed', qty: 0.5, unitCost: 26000, period: 'year' },
      { id: 'op-arch', name: 'Solutions architect & service delivery', enabled: true, category: 'people', driver: 'fixed', qty: 0.25, unitCost: 45000, period: 'year' },
      { id: 'op-tools', name: 'Monitoring, ITSM & RMM tooling', enabled: true, category: 'tools', driver: 'fixed', qty: 1, unitCost: 450, period: 'month' },
      { id: 'op-sec', name: 'SIEM, log retention & vulnerability scanning', enabled: true, category: 'tools', driver: 'fixed', qty: 1, unitCost: 300, period: 'month' },
      { id: 'op-agent', name: 'Per-VM monitoring & patching agent', enabled: true, category: 'tools', driver: 'perVm', qty: 1, unitCost: 2, period: 'month', note: 'Scales with the number of VMs sold.' },
      { id: 'op-ins', name: 'Equipment insurance', enabled: true, category: 'insurance', driver: 'pctCapex', qty: 1, unitCost: 0.4, period: 'year', note: '% of total capex per year.' },
      { id: 'op-audit', name: 'Compliance & audits (ISO 27001 share)', enabled: true, category: 'other', driver: 'fixed', qty: 1, unitCost: 2400, period: 'year' },
    ],
    capacity: {
      vcpuPerCore: 4,
      ramOvercommit: 1,
      cvmCores: 8,
      cvmRamGb: 32,
      hypervisorRamGb: 8,
      haReserve: true,
      maxUtilPct: 90,
      replicationFactor: 2,
      storageOverheadPct: 5,
      dataReduction: 1.2,
      targetOccupancyPct: 80,
    },
    vmSizes: [
      { id: 'xs', name: 'XS', vcpu: 1, ramGb: 2, storageGb: 50, mixPct: 15 },
      { id: 's', name: 'Small', vcpu: 2, ramGb: 4, storageGb: 80, mixPct: 35 },
      { id: 'm', name: 'Medium', vcpu: 4, ramGb: 16, storageGb: 150, mixPct: 30 },
      { id: 'l', name: 'Large', vcpu: 8, ramGb: 32, storageGb: 300, mixPct: 15 },
      { id: 'xl', name: 'X-Large', vcpu: 16, ramGb: 64, storageGb: 500, mixPct: 5 },
    ],
    finance: {
      termMonths: 60,
      costOfCapitalPct: 10,
      overheadPct: 10,
    },
    pricing: {
      targetMarginPct: 35,
      weightMode: 'auto',
      weights: { cpu: 45, ram: 40, storage: 15 },
      paygUpliftPct: 15,
      threeYearDiscountPct: 12,
      rampStartPct: 20,
      rampMonths: 18,
      addOnMarginPct: 40,
      addOns: [
        { id: 'ao-backup', name: 'Backup, 30-day retention', unit: 'per 100 GB protected', cost: 3.5 },
        { id: 'ao-dr', name: 'DR replication to second cluster', unit: 'per VM', cost: 6 },
        { id: 'ao-win', name: 'Windows Server licence (SPLA Standard)', unit: 'per 2 vCPU', cost: 12 },
        { id: 'ao-mos', name: 'Managed OS (patching, monitoring, L1)', unit: 'per VM', cost: 12 },
        { id: 'ao-ip', name: 'Public IPv4 address', unit: 'per IP', cost: 1.2 },
      ],
    },
  }
}
