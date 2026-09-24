import { Card } from '../components/ui'
import { money, num, pct, storage } from '../model/format'
import { useStore } from '../state/context'
import type { ViewProps } from './types'

export function PlaybookView({ go }: ViewProps) {
  const { model, results, money: ctx } = useStore()
  const { totals, monthly, unit, vms, clusters } = results
  const occ = model.capacity.targetOccupancyPct / 100
  const costAtFull = vms.max > 0 ? (monthly.fixedTotal + monthly.variablePerVm * vms.max) / vms.max : null
  const sellableVcpu = clusters.filter((c) => c.role === 'production').reduce((s, c) => s + c.sellable.cpu, 0)
  const sellableStorage = clusters.filter((c) => c.role === 'production').reduce((s, c) => s + c.sellable.storage, 0)
  const rawTb = clusters.filter((c) => c.role === 'production').reduce((s, c) => s + c.rawTb, 0)
  const total = results.breakdown.reduce((s, b) => s + b.monthly, 0)
  const capexShare = results.breakdown.filter((b) => b.kind === 'capex').reduce((s, b) => s + b.monthly, 0) / total
  const medium = results.sizes.find((s) => s.size.id === 'm') ?? results.sizes[0]

  const steps = [
    {
      title: 'Start from the fully loaded cost, not the hardware quote',
      body: (
        <>
          The Cisco BOM is only part of the bill. Nutanix licences, colocation, power, bandwidth, people, tools,
          insurance and overhead all go into the cost per VM. In this model the hardware and prepaid Cisco services are{' '}
          {pct(capexShare)} of the monthly cost; the other {pct(1 - capexShare)} is running cost.
        </>
      ),
      link: { tab: 'opex' as const, label: 'Running costs' },
    },
    {
      title: 'Turn capex into a monthly charge',
      body: (
        <>
          Spread the {money(totals.totalCapex, ctx, { compact: true })} upfront spend over the{' '}
          {model.finance.termMonths}-month life of the support contracts and charge interest at your cost of capital (
          {model.finance.costOfCapitalPct}%). That gives {money(monthly.capitalCharge, ctx)} a month, the same way a
          lease would. Straight-line depreciation alone understates cost because it ignores the money tied up in the
          kit.
        </>
      ),
      link: { tab: 'capex' as const, label: 'Hardware & capex' },
    },
    {
      title: 'Count only the capacity you can safely sell',
      body: (
        <>
          Nutanix keeps a Controller VM on every node, RF{model.capacity.replicationFactor} stores every block{' '}
          {model.capacity.replicationFactor === 2 ? 'twice' : 'three times'}, and an N+1 design keeps one node free per
          cluster. Here {num(totals.physicalCores)} physical cores become {num(sellableVcpu)} sellable vCPUs, and{' '}
          {num(rawTb)} TB of raw disk becomes {storage(sellableStorage)} you can sell. Price the sellable figure, never
          the raw one.
        </>
      ),
      link: { tab: 'capacity' as const, label: 'Capacity' },
    },
    {
      title: 'Price at planned occupancy, not at 100%',
      body: (
        <>
          A cluster is never completely sold. At 100% the average VM would cost {money(costAtFull, ctx)}; at your{' '}
          {pct(occ)} target it costs {money(unit.costPerVm, ctx)}. Pricing on 100% means losing money for the life of
          the platform. Most MSPs plan on 70–85% and treat anything above that as upside.
        </>
      ),
      link: { tab: 'overview' as const, label: 'Overview' },
    },
    {
      title: 'Split the cost into unit rates, then package it',
      body: (
        <>
          Divide the monthly cost between vCPU, memory and disk to get unit rates: here{' '}
          {money(unit.priceRate.cpu, ctx)} per vCPU, {money(unit.priceRate.ram, ctx)} per GB memory and{' '}
          {money(unit.priceRate.storage, ctx)} per GB disk a month at list. Package them into a few fixed VM sizes so
          customers can compare and budget. A {medium?.size.name ?? 'medium'} VM (
          {num(medium?.size.vcpu ?? 0)} vCPU, {num(medium?.size.ramGb ?? 0)} GB) lists at{' '}
          {money(medium?.price ?? null, ctx)}.
        </>
      ),
      link: { tab: 'pricing' as const, label: 'Pricing & rate card' },
    },
    {
      title: 'Add margin, then reward commitment',
      body: (
        <>
          Set price as cost ÷ (1 − margin). Charge a premium for month-to-month ({model.pricing.paygUpliftPct}% here)
          and give a discount for multi-year terms ({model.pricing.threeYearDiscountPct}% for 3 years). Committed terms
          fill the cluster sooner, which lowers the cost per VM for everyone.
        </>
      ),
      link: { tab: 'pricing' as const, label: 'Pricing & rate card' },
    },
    {
      title: 'Earn the margin on services',
      body: (
        <>
          Raw compute competes with hyperscalers on price. Backup, DR replication, managed OS, Windows and database
          licences, public IPs, firewall policies and 24×7 support carry higher margins ({model.pricing.addOnMarginPct}%
          in this model) and make customers stay.
        </>
      ),
      link: { tab: 'pricing' as const, label: 'Add-on services' },
    },
    {
      title: 'Track break-even and review every quarter',
      body: (
        <>
          At the planned price you break even at{' '}
          {vms.breakEven === null ? 'no VM count' : `${num(Math.ceil(vms.breakEven))} VMs`} and get your cash back in{' '}
          {results.cashflow.paybackMonth === null ? 'more than the term' : `month ${results.cashflow.paybackMonth}`}. Re-run
          the numbers when occupancy, the VM mix, FX or licence prices move, and plan the hardware refresh before the
          support term ends.
        </>
      ),
      link: { tab: 'cashflow' as const, label: 'Cash flow' },
    },
  ]

  return (
    <div className="stack playbook">
      <Card title="How service providers build an IaaS price" sub="Eight steps, worked through with the numbers in this model.">
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <button type="button" className="link" onClick={() => go(s.link.tab)}>
                Open {s.link.label}
              </button>
            </li>
          ))}
        </ol>
      </Card>
      <Card title="Common pricing models" sub="Most MSPs combine two or three of these.">
        <div className="table-wrap">
          <table className="data models">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">How it bills</th>
                <th scope="col">Good for</th>
                <th scope="col">Watch out for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Fixed VM sizes</th>
                <td>Monthly price per size (XS to XL)</td>
                <td>SMB customers, simple quotes, self-service portals</td>
                <td>Stranded capacity if the sizes sold drift away from the planned mix</td>
              </tr>
              <tr>
                <th scope="row">Pay per resource</th>
                <td>Per vCPU, GB memory and GB disk, monthly or hourly</td>
                <td>Custom VMs and customers moving from public cloud</td>
                <td>Harder for customers to budget; needs metering and billing integration</td>
              </tr>
              <tr>
                <th scope="row">Reserved resource pool</th>
                <td>Tenant buys a pool (say 64 vCPU, 256 GB, 5 TB) and carves VMs from it</td>
                <td>Enterprise private cloud, predictable revenue</td>
                <td>Tenants overcommit their own pool; set a fair-use policy</td>
              </tr>
              <tr>
                <th scope="row">Dedicated nodes or clusters</th>
                <td>Cost-plus per node, per month, on a fixed term</td>
                <td>Regulated workloads and customers who need isolation</td>
                <td>Low utilisation risk moves to the customer, so margins are thinner</td>
              </tr>
              <tr>
                <th scope="row">Managed VM bundle</th>
                <td>One price for the VM, OS management, backup and monitoring</td>
                <td>Customers without in-house IT</td>
                <td>Support effort varies a lot per VM; price on the heavy end</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Rules of thumb" sub="Starting points to test against your own data.">
        <ul className="thumbs">
          <li>
            <strong>vCPU overcommit:</strong> 3–5 vCPU per physical core for mixed production, higher for dev/test and
            VDI. Measure CPU ready time before raising it.
          </li>
          <li>
            <strong>Memory:</strong> sell at 1:1 on AHV. Memory is usually the first resource to run out.
          </li>
          <li>
            <strong>Occupancy:</strong> plan on 70–85% of sellable capacity. Order the next nodes when you pass 70%, so
            they arrive before you hit the N+1 reserve.
          </li>
          <li>
            <strong>Margins:</strong> raw IaaS usually lands at 25–40% gross margin; managed services and add-ons at
            40–60%.
          </li>
          <li>
            <strong>Currency:</strong> Cisco and Nutanix bill in USD while customers pay in INR. Add an FX buffer or
            re-price yearly.
          </li>
        </ul>
      </Card>
    </div>
  )
}
