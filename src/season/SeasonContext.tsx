import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Button, Result, Space } from 'antd'
import { PalloneSpinner } from '../components/PalloneSpinner'
import { config } from '../config'
import * as store from '../services/driveStore'
import { useAuth } from '../auth/AuthContext'

interface SeasonValue {
  stagioni: string[]
  attiva: string
  cambia: (stagione: string) => void
  /** Crea una nuova stagione e la rende attiva. */
  crea: (stagione: string) => boolean
  elimina: (stagione: string) => void
}

const SeasonContext = createContext<SeasonValue | null>(null)

function ordina(stagioni: string[]): string[] {
  return [...stagioni].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
}

/**
 * L'elenco delle stagioni vive sul Drive (foglio "Stagioni"), quindi è
 * condiviso tra tutti. Il provider lo carica all'avvio e lo aggiorna sul
 * Drive a ogni cambio/creazione/eliminazione.
 */
export function SeasonProvider({ children }: { children: ReactNode }) {
  const { esci } = useAuth()
  const [cfg, setCfg] = useState<{ stagioni: string[]; attiva: string } | null>(null)
  const [stato, setStato] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errore, setErrore] = useState('')
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let annullato = false
    setStato('loading')
    setErrore('')
    ;(async () => {
      try {
        const c = await store.seasonsConfig()
        let stagioni: string[]
        let attiva: string
        if (c === null) {
          // script non ancora aggiornato: modalità a stagione singola
          stagioni = [config.season]
          attiva = config.season
        } else if (!c.stagioni.length) {
          // primo avvio: crea la stagione di default sul Drive
          stagioni = [config.season]
          attiva = config.season
          await store.setSeasonsConfig(stagioni, attiva)
        } else {
          stagioni = c.stagioni
          attiva = c.attiva && c.stagioni.includes(c.attiva) ? c.attiva : c.stagioni[0]
        }
        if (!annullato) {
          setCfg({ stagioni: ordina(stagioni), attiva })
          setStato('ready')
        }
      } catch (e) {
        if (!annullato) {
          setErrore(String((e as Error)?.message || e))
          setStato('error')
        }
      }
    })()
    return () => {
      annullato = true
    }
  }, [tentativo])

  const cambia = useCallback((s: string) => {
    setCfg((prev) => {
      if (!prev || !prev.stagioni.includes(s) || s === prev.attiva) return prev
      store.setSeasonsConfig(prev.stagioni, s).catch(() => undefined)
      return { ...prev, attiva: s }
    })
  }, [])

  const crea = useCallback((stagione: string) => {
    const nome = stagione.trim()
    let ok = false
    setCfg((prev) => {
      if (!prev || !nome || prev.stagioni.includes(nome)) return prev
      ok = true
      const stagioni = ordina([...prev.stagioni, nome])
      store.setSeasonsConfig(stagioni, nome).catch(() => undefined)
      return { stagioni, attiva: nome }
    })
    return ok
  }, [])

  const elimina = useCallback((s: string) => {
    setCfg((prev) => {
      if (!prev || prev.stagioni.length <= 1 || !prev.stagioni.includes(s)) return prev
      const stagioni = prev.stagioni.filter((x) => x !== s)
      const attiva = prev.attiva === s ? stagioni[0] : prev.attiva
      store.setSeasonsConfig(stagioni, attiva).catch(() => undefined)
      return { stagioni, attiva }
    })
  }, [])

  if (stato === 'loading') return <SeasonSplash />
  if (stato === 'error' || !cfg)
    return (
      <SeasonSplash
        errore={errore}
        onRiprova={() => setTentativo((t) => t + 1)}
        onEsci={esci}
      />
    )

  return (
    <SeasonContext.Provider
      value={{ stagioni: cfg.stagioni, attiva: cfg.attiva, cambia, crea, elimina }}
    >
      {children}
    </SeasonContext.Provider>
  )
}

function SeasonSplash({
  errore,
  onRiprova,
  onEsci,
}: {
  errore?: string
  onRiprova?: () => void
  onEsci?: () => void
}) {
  if (errore) {
    return (
      <div className="drive-splash" style={{ minHeight: '100vh' }}>
        <Result
          status="warning"
          title="Non riesco a leggere le stagioni dal Drive"
          subTitle={errore}
          extra={
            <Space>
              {onRiprova && (
                <Button type="primary" onClick={onRiprova}>
                  Riprova
                </Button>
              )}
              {onEsci && <Button onClick={onEsci}>Rifai l'accesso</Button>}
            </Space>
          }
        />
      </div>
    )
  }
  return (
    <div className="drive-splash" style={{ minHeight: '100vh' }}>
      <PalloneSpinner />
      <p className="drive-splash-text">Carico le stagioni…</p>
    </div>
  )
}

export function useSeason(): SeasonValue {
  const ctx = useContext(SeasonContext)
  if (!ctx) throw new Error('useSeason deve stare dentro SeasonProvider')
  return ctx
}
