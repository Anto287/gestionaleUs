import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { config } from '../config'
import * as store from '../services/driveStore'

const GATE_KEY = 'usriolunato:__gate'
const driveMode = !!config.drive.url

interface AuthValue {
  sbloccato: boolean
  /** Prova la password: true se corretta. Con Drive, la password è la chiave. */
  sblocca: (password: string) => Promise<boolean>
  esci: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function initSbloccato(): boolean {
  if (driveMode) return store.getSecret() !== ''
  return localStorage.getItem(GATE_KEY) === 'ok'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sbloccato, setSbloccato] = useState(initSbloccato)

  const sblocca = useCallback(async (password: string) => {
    if (driveMode) {
      const ok = await store.testSecret(password.trim())
      if (ok) {
        store.setSecret(password.trim())
        setSbloccato(true)
      }
      return ok
    }
    // modalità locale (senza Drive, solo sviluppo): qualsiasi password non vuota
    if (password.trim()) {
      localStorage.setItem(GATE_KEY, 'ok')
      setSbloccato(true)
      return true
    }
    return false
  }, [])

  const esci = useCallback(() => {
    if (driveMode) store.clearSecret()
    else localStorage.removeItem(GATE_KEY)
    setSbloccato(false)
  }, [])

  const value = useMemo(() => ({ sbloccato, sblocca, esci }), [sbloccato, sblocca, esci])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve stare dentro AuthProvider')
  return ctx
}
