import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { calculate } from '../model/calc'
import { defaultModel } from '../model/defaults'
import type { MoneyCtx } from '../model/format'
import type { Model } from '../model/types'
import { StoreContext } from './context'
import { loadModel, saveModel } from './persistence'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<Model>(loadModel)

  useEffect(() => {
    const t = window.setTimeout(() => saveModel(model), 300)
    return () => window.clearTimeout(t)
  }, [model])

  const update = useCallback((fn: (m: Model) => Model) => setModel((m) => fn(m)), [])
  const replace = useCallback((m: Model) => setModel(m), [])
  const reset = useCallback(() => setModel(defaultModel()), [])
  const results = useMemo(() => calculate(model), [model])
  const money = useMemo<MoneyCtx>(
    () => ({ currency: model.currency, fx: model.fxInrPerUsd }),
    [model.currency, model.fxInrPerUsd],
  )

  const value = useMemo(
    () => ({ model, results, money, update, replace, reset }),
    [model, results, money, update, replace, reset],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
