export type TabId = 'overview' | 'capacity' | 'capex' | 'opex' | 'pricing' | 'cashflow' | 'playbook'

export interface ViewProps {
  go: (id: TabId) => void
}
