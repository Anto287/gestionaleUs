import { createContext, useContext } from 'react'

interface ManagementValue {
  sbloccato: boolean
  logoClick: () => void
  chiudi: () => void
  request: <T>(action: string, body?: Record<string, unknown>) => Promise<T>
}
export const Context = createContext<ManagementValue | null>(null)


export function useManagement() {
  const value = useContext(Context)
  if (!value) throw new Error('ManagementProvider mancante')
  return value
}
