/** Level monthly payment that repays `principal` over `months` at `monthlyRate`. */
export function pmt(monthlyRate: number, months: number, principal: number): number {
  if (months <= 0) return 0
  if (monthlyRate === 0) return principal / months
  const f = Math.pow(1 + monthlyRate, months)
  return (principal * monthlyRate * f) / (f - 1)
}

/** Net present value of cash flows, where flows[0] happens now. */
export function npv(ratePerPeriod: number, flows: number[]): number {
  return flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + ratePerPeriod, t), 0)
}

/**
 * Internal rate of return per period, found by bisection. Returns null when
 * the flows never change sign, so no rate makes the NPV zero.
 */
export function irr(flows: number[]): number | null {
  let lo = -0.99
  let hi = 1
  let fLo = npv(lo, flows)
  const fHi = npv(hi, flows)
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fMid = npv(mid, flows)
    if (Math.abs(fMid) < 1e-7) return mid
    if (fLo * fMid < 0) {
      hi = mid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}
