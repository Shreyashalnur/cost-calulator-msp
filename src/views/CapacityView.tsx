import { Card, Meter, NumField, Pill, Segmented, Switch } from '../components/ui'
import type { ClusterCapacity } from '../model/calc'
import { num, pct, storage } from '../model/format'
import type { BomGroup, BomLine, ClusterRole, Model, Resource, VmSize } from '../model/types'
import { patchSection, useStore } from '../state/context'
import { RESOURCE_LABEL } from './labels'

const SPEC_LABEL: Record<string, string> = {
  cpu: 'CPUs per node',
  dimm: 'DIMMs per node',
  hdd: 'HDDs per node',
  ssd: 'SSDs per node',
}

function updateGroup(m: Model, id: string, fn: (g: BomGroup) => BomGroup): Model {
  return { ...m, groups: m.groups.map((g) => (g.id === id ? fn(g) : g)) }
}

function updateLine(g: BomGroup, id: string, patch: Partial<BomLine>): BomGroup {
  return { ...g, lines: g.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }
}

export function CapacityView() {
  const { model, results } = useStore()
  return (
    <div className="stack">
      <div className="grid two">
        {model.groups
          .filter((g) => g.kind === 'cluster')
          .map((g) => (
            <ClusterCard key={g.id} group={g} cap={results.clusters.find((c) => c.groupId === g.id)!} />
          ))}
      </div>
      <div className="grid three">
        <ComputeSettings />
        <StorageSettings />
        <Card title="VMs sold" sub="The commercial assumption behind cost per VM.">
          <OccupancySettings />
        </Card>
      </div>
      <VmCatalogue />
    </div>
  )
}

function ClusterCard({ group, cap }: { group: BomGroup; cap: ClusterCapacity }) {
  const { update } = useStore()
  const specLines = group.lines.filter((l) => l.spec && l.perNode)
  return (
    <Card
      title={group.name}
      sub={group.note}
      actions={cap.role === 'dr' ? <Pill tone="muted">DR target</Pill> : <Pill tone="accent">{num(cap.maxVms)} VMs</Pill>}
    >
      <div className="form-row">
        <NumField
          id={`${group.id}-nodes`}
          label="Nodes"
          value={group.nodes ?? 0}
          min={0}
          max={64}
          decimals={0}
          onChange={(v) => update((m) => updateGroup(m, group.id, (g) => ({ ...g, nodes: Math.round(v) })))}
          hint="Per-node BOM lines scale with this."
        />
        {specLines.map((l) => (
          <NumField
            key={l.id}
            id={`${l.id}-qty`}
            label={SPEC_LABEL[l.spec!.kind]}
            value={l.qty}
            min={0}
            decimals={0}
            onChange={(v) => update((m) => updateGroup(m, group.id, (g) => updateLine(g, l.id, { qty: Math.round(v) })))}
            hint={specHint(l)}
          />
        ))}
        <Segmented<ClusterRole>
          id={`${group.id}-role`}
          label="Role"
          value={group.role ?? 'production'}
          options={[
            { value: 'production', label: 'Production' },
            { value: 'dr', label: 'DR target' },
          ]}
          onChange={(v) => update((m) => updateGroup(m, group.id, (g) => ({ ...g, role: v })))}
        />
      </div>
      <p className="spec-line">
        Per node: <strong>{num(cap.coresPerNode)} cores</strong> · <strong>{num(cap.ramPerNodeGb)} GB RAM</strong> ·{' '}
        <strong>{num(cap.hddTb / Math.max(1, cap.nodes), 1)} TB HDD</strong> +{' '}
        <strong>{num(cap.ssdTb / Math.max(1, cap.nodes), 2)} TB SSD</strong>
      </p>
      <h3 className="minor">From raw hardware to sellable capacity</h3>
      <div className="funnels">
        {(['cpu', 'ram', 'storage'] as Resource[]).map((r) => (
          <Funnel key={r} resource={r} cap={cap} />
        ))}
      </div>
    </Card>
  )
}

function specHint(l: BomLine): string {
  const s = l.spec!
  if (s.kind === 'cpu') return `${s.cores} cores each · ${l.sku}`
  if (s.kind === 'dimm') return `${s.gb} GB each · ${l.sku}`
  return `${s.tb} TB each · ${l.sku}`
}

function Funnel({ resource, cap }: { resource: Resource; cap: ClusterCapacity }) {
  const steps = cap.funnel[resource]
  const top = Math.max(...steps.map((s) => s.value), 1)
  const fmt = (v: number) =>
    resource === 'cpu'
      ? num(v)
      : resource === 'ram'
        ? `${num(v)} GB`
        : storage(v)
  const unitLabel = resource === 'cpu' ? 'cores → vCPU' : resource === 'ram' ? 'GB' : 'binary TB'
  return (
    <div className="funnel">
      <div className="funnel-head">
        <strong>{RESOURCE_LABEL[resource]}</strong>
        <span className="muted">{unitLabel}</span>
      </div>
      <ol>
        {steps.map((s, i) => (
          <li key={i} className={i === steps.length - 1 ? 'final' : undefined}>
            <span className="funnel-label">{s.label}</span>
            <span className="funnel-bar">
              <span style={{ width: `${(s.value / top) * 100}%` }} />
            </span>
            <span className="num">{fmt(s.value)}</span>
          </li>
        ))}
      </ol>
      <p className="funnel-foot">
        Fits <strong>{Number.isFinite(cap.vmsBy[resource]) ? num(Math.floor(cap.vmsBy[resource])) : '∞'}</strong> average
        VMs{cap.binding === resource ? <Pill tone="warn">limit</Pill> : null}
      </p>
    </div>
  )
}

function ComputeSettings() {
  const { model, update } = useStore()
  const c = model.capacity
  const set = (patch: Partial<Model['capacity']>) => update(patchSection('capacity', patch))
  return (
    <Card title="Compute & HA" sub="Nutanix reserves and your overcommit policy.">
      <div className="form-grid">
        <NumField id="vcpu-ratio" label="vCPUs per physical core" value={c.vcpuPerCore} min={0.5} max={16} suffix=": 1" onChange={(v) => set({ vcpuPerCore: v })} hint="4:1 is a common ceiling for mixed production workloads." />
        <NumField id="ram-oc" label="Memory overcommit" value={c.ramOvercommit} min={1} max={2} suffix=": 1" onChange={(v) => set({ ramOvercommit: v })} hint="AHV runs best at 1:1." />
        <NumField id="cvm-cores" label="CVM cores per node" value={c.cvmCores} min={0} max={32} decimals={0} onChange={(v) => set({ cvmCores: v })} hint="Controller VM runs on every node." />
        <NumField id="cvm-ram" label="CVM memory per node" value={c.cvmRamGb} min={0} max={128} suffix="GB" decimals={0} onChange={(v) => set({ cvmRamGb: v })} />
        <NumField id="ahv-ram" label="AHV host memory per node" value={c.hypervisorRamGb} min={0} max={64} suffix="GB" decimals={0} onChange={(v) => set({ hypervisorRamGb: v })} />
        <NumField id="max-util" label="Maximum load" value={c.maxUtilPct} min={10} max={100} suffix="%" decimals={0} onChange={(v) => set({ maxUtilPct: v })} hint="Headroom kept on top of the N+1 reserve." />
      </div>
      <Switch id="ha" checked={c.haReserve} onChange={(v) => set({ haReserve: v })} label="Hold back one node per cluster (N+1) for failover and rebuilds" />
    </Card>
  )
}

function StorageSettings() {
  const { model, update } = useStore()
  const c = model.capacity
  const set = (patch: Partial<Model['capacity']>) => update(patchSection('capacity', patch))
  return (
    <Card title="Storage" sub="How Nutanix turns raw disk into usable capacity.">
      <div className="form-grid">
        <Segmented<'2' | '3'>
          id="rf"
          label="Replication factor"
          value={String(c.replicationFactor) as '2' | '3'}
          options={[
            { value: '2', label: 'RF2' },
            { value: '3', label: 'RF3' },
          ]}
          onChange={(v) => set({ replicationFactor: v === '3' ? 3 : 2 })}
          hint="RF3 needs at least 5 nodes."
        />
        <NumField id="st-oh" label="System overhead" value={c.storageOverheadPct} min={0} max={50} suffix="%" decimals={1} onChange={(v) => set({ storageOverheadPct: v })} hint="Metadata, Curator, oplog." />
        <NumField id="dr-ratio" label="Data reduction" value={c.dataReduction} min={1} max={5} suffix=": 1" onChange={(v) => set({ dataReduction: v })} hint="Compression only. Use 1.0 until measured." />
      </div>
    </Card>
  )
}

function OccupancySettings() {
  const { model, results, update } = useStore()
  return (
    <div className="form-grid">
      <NumField
        id="occ"
        label="Target occupancy"
        value={model.capacity.targetOccupancyPct}
        min={1}
        max={100}
        suffix="%"
        decimals={0}
        onChange={(v) => update(patchSection('capacity', { targetOccupancyPct: v }))}
        hint="Share of sellable capacity sold at steady state. MSPs plan on 70–85%."
      />
      <dl className="facts">
        <div>
          <dt>Sellable VMs</dt>
          <dd>{num(results.vms.max)}</dd>
        </div>
        <div>
          <dt>Sold at target</dt>
          <dd>{num(results.vms.sold)}</dd>
        </div>
        <div>
          <dt>vCPU sold</dt>
          <dd>{num(results.unit.sold.cpu)}</dd>
        </div>
        <div>
          <dt>Memory sold</dt>
          <dd>{num(results.unit.sold.ram)} GB</dd>
        </div>
        <div>
          <dt>Storage sold</dt>
          <dd>{storage(results.unit.sold.storage)}</dd>
        </div>
      </dl>
    </div>
  )
}

function VmCatalogue() {
  const { model, results, update } = useStore()
  const totalMix = model.vmSizes.reduce((s, v) => s + v.mixPct, 0)
  const set = (id: string, patch: Partial<VmSize>) =>
    update((m) => ({ ...m, vmSizes: m.vmSizes.map((v) => (v.id === id ? { ...v, ...patch } : v)) }))
  const add = () =>
    update((m) => ({
      ...m,
      vmSizes: [...m.vmSizes, { id: `size-${Date.now()}`, name: 'Custom', vcpu: 2, ramGb: 8, storageGb: 100, mixPct: 0 }],
    }))
  const remove = (id: string) => update((m) => ({ ...m, vmSizes: m.vmSizes.filter((v) => v.id !== id) }))
  const avg = results.avgVm
  return (
    <Card
      title="VM catalogue & sales mix"
      sub="The sizes you sell and the share of each. Their weighted average is the 'average VM' used for cost per VM."
      actions={
        <button type="button" className="btn" onClick={add}>
          Add size
        </button>
      }
    >
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Size</th>
              <th scope="col" className="num">vCPU</th>
              <th scope="col" className="num">Memory (GB)</th>
              <th scope="col" className="num">Disk (GB)</th>
              <th scope="col" className="num">Mix %</th>
              <th scope="col" className="num">GB per vCPU</th>
              <th scope="col" className="num">VMs at target</th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {model.vmSizes.map((v) => (
              <tr key={v.id}>
                <td>
                  <input
                    id={`${v.id}-name`}
                    className="text-cell"
                    value={v.name}
                    aria-label="Size name"
                    onChange={(e) => set(v.id, { name: e.target.value })}
                  />
                </td>
                <td className="num"><NumField cell id={`${v.id}-vcpu`} ariaLabel={`${v.name} vCPU`} value={v.vcpu} min={0} onChange={(x) => set(v.id, { vcpu: x })} /></td>
                <td className="num"><NumField cell id={`${v.id}-ram`} ariaLabel={`${v.name} memory`} value={v.ramGb} min={0} onChange={(x) => set(v.id, { ramGb: x })} /></td>
                <td className="num"><NumField cell id={`${v.id}-disk`} ariaLabel={`${v.name} disk`} value={v.storageGb} min={0} onChange={(x) => set(v.id, { storageGb: x })} /></td>
                <td className="num"><NumField cell id={`${v.id}-mix`} ariaLabel={`${v.name} mix`} value={v.mixPct} min={0} max={100} onChange={(x) => set(v.id, { mixPct: x })} /></td>
                <td className="num muted">{v.vcpu > 0 ? num(v.ramGb / v.vcpu, 1) : '—'}</td>
                <td className="num">{totalMix > 0 ? num((results.vms.sold * v.mixPct) / totalMix) : '—'}</td>
                <td>
                  <button type="button" className="icon-btn" aria-label={`Remove ${v.name}`} onClick={() => remove(v.id)} disabled={model.vmSizes.length <= 1}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Average VM</th>
              <td className="num">{num(avg.vcpu, 2)}</td>
              <td className="num">{num(avg.ramGb, 1)}</td>
              <td className="num">{num(avg.storageGb)}</td>
              <td className="num">
                {num(totalMix)}%{Math.abs(totalMix - 100) > 0.01 && <span className="muted"> (scaled to 100)</span>}
              </td>
              <td className="num">{avg.vcpu > 0 ? num(avg.ramGb / avg.vcpu, 1) : '—'}</td>
              <td className="num">{num(results.vms.sold)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <h3 className="minor">Fit per cluster when full</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Cluster</th>
              {(['cpu', 'ram', 'storage'] as Resource[]).map((r) => (
                <th key={r} scope="col">{RESOURCE_LABEL[r]} used</th>
              ))}
              <th scope="col" className="num">Max VMs</th>
            </tr>
          </thead>
          <tbody>
            {results.clusters.map((c) => (
              <tr key={c.groupId}>
                <th scope="row">{c.name}</th>
                {(['cpu', 'ram', 'storage'] as Resource[]).map((r) => (
                  <td key={r}>
                    <span className="meter-cell">
                      <Meter value={c.usedAtMax[r]} tone={c.binding === r ? 'warn' : 'accent'} label={`${RESOURCE_LABEL[r]} used`} />
                      <span className="num">{pct(c.usedAtMax[r])}</span>
                    </span>
                  </td>
                ))}
                <td className="num">
                  {c.role === 'dr' ? <span className="muted">DR ({num(c.hostableVms)})</span> : num(c.maxVms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
