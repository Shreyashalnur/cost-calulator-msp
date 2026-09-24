import { createContext, useContext } from 'react'
import type { Results } from '../model/calc'
import type { MoneyCtx } from '../model/format'
import type { Model } from '../model/types'

export interface Store {
  model: Model
  results: Results
  money: MoneyCtx
  update: (fn: (m: Model) => Model) => void
  replace: (m: Model) => void
  reset: () => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

/** Shallow-merges a patch into one top-level section of the model. */
export function patchSection<K extends 'facility' | 'capacity' | 'finance' | 'pricing'>(
  key: K,
  patch: Partial<Model[K]>,
) {
  return (m: Model): Model => ({ ...m, [key]: { ...m[key], ...patch } })
}
