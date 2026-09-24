import { describe, expect, it } from 'vitest'
import { defaultModel } from '../model/defaults'
import { parseModel } from './persistence'

describe('parseModel', () => {
  it('round-trips an exported scenario', () => {
    const m = defaultModel()
    m.capacity.vcpuPerCore = 6
    m.currency = 'USD'
    expect(parseModel(JSON.stringify(m))).toEqual(m)
  })

  it('fills sections missing from an older save', () => {
    const m = defaultModel()
    const partial = { ...m, facility: { rackFee: 999 } }
    const parsed = parseModel(JSON.stringify(partial))
    expect(parsed.facility.rackFee).toBe(999)
    expect(parsed.facility.pue).toBe(m.facility.pue)
  })

  it('ignores a file from a different model version', () => {
    const parsed = parseModel(JSON.stringify({ version: -1, currency: 'USD' }))
    expect(parsed).toEqual(defaultModel())
  })

  it('throws on text that is not JSON', () => {
    expect(() => parseModel('not json')).toThrow()
  })
})
