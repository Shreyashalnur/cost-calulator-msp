# Nutanix MSP Cost Model

A dashboard that works out the **cost and price per VM** for a managed service provider (MSP) running a private cloud on
**Cisco Compute Hyperconverged M8 with Nutanix AHV**. It includes the Cisco bill of materials, other capex, colocation,
power, bandwidth, people, licences and overhead.

The default scenario is loaded from the supplied Cisco BOM:

| Block | What is in it |
| --- | --- |
| Nutanix cluster 1 (memory-dense) | 3 × HCI 240c M8 LFF, each 2 × Xeon 6527P (24C), 16 × 64 GB (1 TB), 4 × 16 TB HDD + 2 × 3.84 TB SSD |
| Nutanix cluster 2 (storage-dense) | 3 × HCI 240c M8 LFF, each 2 × Xeon 6527P (24C), 8 × 64 GB (512 GB), 6 × 16 TB HDD + 2 × 3.84 TB SSD |
| Perimeter security | Secure Firewall 3130 HA pair, 5-year Threat + Malware, virtual FMC |
| DC core | 2 × Catalyst 9500-24Y4C with optics and DAC/AOC cabling |
| Access & management | 2 × Catalyst 9300-24T stacks with 8×10G modules, 5-year DNA Advantage |

All Cisco service and subscription lines use the 60-month term from the quote.

> **The unit list prices are placeholders.** The quote came without prices, so every line carries an indicative USD list
> price. Put your quote's unit list price and discount on the **Hardware & capex** tab, or type the unit net price and
> the discount is worked out for you.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the cost engine
npm run build      # static site in dist/, served from any path
```

Scenarios save in the browser automatically. Use **Export scenario** and **Import** to share one as a JSON file.

## The dashboard

| Tab | What you do there |
| --- | --- |
| Overview | Headline numbers, quick levers, where each VM's cost goes, cost per VM against occupancy, capacity per cluster |
| Capacity | Node count, DIMMs, drives and role per cluster; CVM, N+1, overcommit and RF settings; the VM catalogue and sales mix |
| Hardware & capex | The full Cisco BOM with list, discount and net per line; other one-time costs; term and cost of capital |
| Running costs | Colocation, power (metered kWh × PUE or committed kW), bandwidth and IPs, licences, people, tools, insurance, overhead |
| Pricing & rate card | Margin, commitment tiers, unit rates per vCPU / GB memory / GB disk, VM price list, add-on services |
| Cash flow | Sales ramp, payback month, peak funding need, NPV, IRR and a year-by-year P&L |
| How MSPs price | The eight-step method service providers use, worked through with your numbers |

Switch between **₹ INR** and **$ USD** at the top. Values are stored in USD, the currency of Cisco and Nutanix quotes, and
converted at the ₹/$ rate you enter. INR amounts use lakh and crore grouping.

## How the cost per VM is calculated

1. **Capex.** BOM net (list × (1 − discount)) plus one-time costs (services, PDUs, cabling, spares, freight) plus the
   colocation install fee.
2. **Capital charge.** Capex is turned into a level monthly payment over the term at the cost of capital, like a lease.
   At 0% this is straight-line depreciation.
3. **Opex.** Rack space, power (typical watts from the BOM × PUE × tariff, or committed kW), cross-connects, remote
   hands, bandwidth, IPs, then every enabled licence, people, tools and insurance line. Lines can be fixed, per physical
   core, per VM sold or a % of capex. Corporate overhead is a % on top of opex.
4. **Sellable capacity**, per cluster:
   - vCPU = usable nodes × (cores − CVM cores) × vCPU:core ratio × maximum load
   - Memory = usable nodes × (RAM − CVM − AHV reserve) × overcommit × maximum load
   - Storage = raw TB → GiB × (usable ÷ total nodes) ÷ RF × (1 − overhead) × maximum fill × data reduction
   - With N+1 on, usable nodes = nodes − 1.
5. **VMs per cluster.** The weighted average of the VM catalogue is divided into each resource, and the scarcest resource
   sets the VM count. DR clusters add cost but no sellable VMs.
6. **Cost per VM** = monthly cost at target occupancy ÷ VMs sold. **Price** = cost ÷ (1 − margin).
7. **Unit rates.** Fixed cost is split between vCPU, memory and disk (from each resource's own spend, or by hand) and
   divided by what is sold. At the planned mix and occupancy the rates recover the full monthly cost. The tests check
   this.

## Project layout

```
src/model/defaults.ts      BOM and default assumptions
src/model/calc.ts          cost, capacity, pricing and cash-flow engine (pure functions)
src/model/calc.test.ts     engine tests
src/model/finance.ts       PMT, NPV, IRR
src/state/                 React store and browser persistence
src/views/                 one file per dashboard tab
src/components/            form controls and charts
```

Built with React, TypeScript, Vite and Recharts.
