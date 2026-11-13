// Lets any button on the page open the estimate form with a service chosen.
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface EstimateContextValue {
  service: string
  setService: (key: string) => void
  /** Scroll to the form, optionally preselecting a service. */
  openEstimate: (service?: string) => void
}

const EstimateContext = createContext<EstimateContextValue | null>(null)

export function EstimateProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState('')

  const openEstimate = useCallback((next?: string) => {
    if (next) setService(next)
    const form = document.getElementById('estimate-form')
    if (!form) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => document.getElementById('estimate-name')?.focus({ preventScroll: true }), reduce ? 0 : 650)
  }, [])

  const value = useMemo(() => ({ service, setService, openEstimate }), [service, openEstimate])
  return <EstimateContext.Provider value={value}>{children}</EstimateContext.Provider>
}

export function useEstimate(): EstimateContextValue {
  const value = useContext(EstimateContext)
  if (!value) throw new Error('useEstimate must be used inside EstimateProvider')
  return value
}
