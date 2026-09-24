import { defaultModel, MODEL_VERSION } from '../model/defaults'
import type { Model } from '../model/types'

export const STORAGE_KEY = 'ntnx-msp-cost-model'

export function loadModel(): Model {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return parseModel(raw)
  } catch {
    // Storage can be blocked (private windows, sandboxed previews). Fall back to defaults.
  }
  return defaultModel()
}

export function saveModel(model: Model): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model))
  } catch {
    // Saving is a convenience only.
  }
}

/** Reads a saved or exported model, filling any section it lacks from the defaults. */
export function parseModel(raw: string): Model {
  const data = JSON.parse(raw) as Partial<Model>
  const base = defaultModel()
  if (!data || typeof data !== 'object' || data.version !== MODEL_VERSION) return base
  return {
    ...base,
    ...data,
    discounts: { ...base.discounts, ...data.discounts },
    facility: { ...base.facility, ...data.facility },
    capacity: { ...base.capacity, ...data.capacity },
    finance: { ...base.finance, ...data.finance },
    pricing: { ...base.pricing, ...data.pricing, weights: { ...base.pricing.weights, ...data.pricing?.weights } },
    groups: Array.isArray(data.groups) ? data.groups : base.groups,
    oneTime: Array.isArray(data.oneTime) ? data.oneTime : base.oneTime,
    opex: Array.isArray(data.opex) ? data.opex : base.opex,
    vmSizes: Array.isArray(data.vmSizes) ? data.vmSizes : base.vmSizes,
  }
}
