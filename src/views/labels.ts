import type { Resource } from '../model/types'

/** Column and heading labels. */
export const RESOURCE_LABEL: Record<Resource, string> = { cpu: 'vCPU', ram: 'Memory', storage: 'Storage' }

/** The same names for use inside a sentence. */
export const RESOURCE_WORD: Record<Resource, string> = { cpu: 'vCPU', ram: 'memory', storage: 'storage' }
