import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { App as AntApp, Button, Result, Space } from 'antd'
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

type Cfg = { stagioni: string[]; attiva: string }

function ordina(stagioni: string[]): string[] {
  return [...stagioni].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
}

/**
 * L'elenco delle stagioni vive sul Drive (foglio "Stagioni"), quindi è
 * condiviso tra tutti. Il provider lo carica all'avvio e lo aggiorna sul
 * Drive a ogni cambio/creazione/eliminazione.
 *
 * Se il browser ha ancora l'elenco dell'ultima volta si parte da quello,
 * senza schermata d'attesa: la rilettura dal Drive va avanti in sottofondo
 * e corregge il tiro se nel frattempo è cambiato qualcosa.
 */
export function SeasonProvider({ children }: { children: ReactNode }) {
  const { esci } = useAuth()
  const { message } = AntApp.useApp()
  const [cfg, setCfg] = useState<Cfg | null>(() => {
    const c = store.seasonsConfigCache()
    return c ? { stagioni: ordina(c.stagioni), attiva: c.attiva || c.stagioni[0] } : null
  })
  const [stato, setStato] = useState<'loading' | 'ready' | 'error'>(cfg ? 'ready' : 'loading')
  const [errore, setErrore] = useState('')
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let annullato = false
    // con l'elenco della volta scorsa in mano non si torna allo spinner:
    // si rilegge e basta
    setStato((s) => (s === 'ready' ? s : 'loading'))
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
          // se l'elenco della volta scorsa c'è già, si continua con quello
          setStato((s) => (s === 'ready' ? s : 'error'))
        }
      }
    })()
    return () => {
      annullato = true
    }
  }, [tentativo])

  // stato corrente letto fuori dagli updater (in StrictMode girano due volte)
  const cfgRef = useRef(cfg)
  useEffect(() => {
    cfgRef.current = cfg
  }, [cfg])
  const coda = useRef<Promise<void>>(Promise.resolve())
  const inAttesa = useRef(0)

  /**
   * Salva sul Drive una modifica all'elenco: prima rilegge l'elenco fresco
   * (un altro dispositivo può averlo cambiato) e applica lì solo la
   * differenza; se la rilettura non riesce si usa quello in memoria.
   */
  const salva = useCallback(
    (modifica: (c: Cfg) => Cfg | null, locale: Cfg) => {
      inAttesa.current++
      coda.current = coda.current.then(async () => {
        try {
          let base = locale
          try {
            const fresco = await store.seasonsConfig()
            if (fresco?.stagioni.length) base = { stagioni: fresco.stagioni, attiva: fresco.attiva }
          } catch {
            /* rilettura fallita: si scrive l'elenco in memoria */
          }
          const nuovo = modifica(base)
          if (!nuovo) {
            // niente da scrivere (es. stagione già tolta altrove): ci si allinea al Drive
            if (inAttesa.current === 1) {
              const stagioni = ordina(base.stagioni)
              const ripiego = stagioni.includes(base.attiva) ? base.attiva : stagioni[stagioni.length - 1]
              setCfg((prev) =>
                prev ? { stagioni, attiva: stagioni.includes(prev.attiva) ? prev.attiva : ripiego } : prev,
              )
            }
            return
          }
          const stagioni = ordina(nuovo.stagioni)
          await store.setSeasonsConfig(stagioni, nuovo.attiva)
          // riallinea l'elenco a quello salvato (se non ci sono altre modifiche in coda)
          if (inAttesa.current === 1) {
            setCfg((prev) =>
              prev
                ? { stagioni, attiva: stagioni.includes(prev.attiva) ? prev.attiva : nuovo.attiva }
                : prev,
            )
          }
        } catch (e) {
          message.error('Elenco stagioni non salvato sul Drive: ' + String((e as Error)?.message || e))
        } finally {
          inAttesa.current--
        }
      })
    },
    [message],
  )

  const cambia = useCallback(
    (s: string) => {
      const prev = cfgRef.current
      if (!prev || !prev.stagioni.includes(s) || s === prev.attiva) return
      const locale = { ...prev, attiva: s }
      cfgRef.current = locale
      setCfg(locale)
      salva((c) => (c.stagioni.includes(s) ? { ...c, attiva: s } : null), locale)
    },
    [salva],
  )

  const crea = useCallback(
    (stagione: string) => {
      const nome = stagione.trim()
      const prev = cfgRef.current
      if (!prev || !nome || prev.stagioni.includes(nome)) return false
      const locale = { stagioni: ordina([...prev.stagioni, nome]), attiva: nome }
      cfgRef.current = locale
      setCfg(locale)
      salva(
        (c) => ({ stagioni: c.stagioni.includes(nome) ? c.stagioni : [...c.stagioni, nome], attiva: nome }),
        locale,
      )
      return true
    },
    [salva],
  )

  const elimina = useCallback(
    (s: string) => {
      const prev = cfgRef.current
      if (!prev || prev.stagioni.length <= 1 || !prev.stagioni.includes(s)) return
      // se sparisce quella attiva si passa alla più recente rimasta (l'elenco è in ordine crescente)
      const togli = (c: Cfg) => {
        const stagioni = ordina(c.stagioni.filter((x) => x !== s))
        if (!stagioni.length) return null
        const attiva = c.attiva === s || !stagioni.includes(c.attiva) ? stagioni[stagioni.length - 1] : c.attiva
        return { stagioni, attiva }
      }
      const locale = togli(prev)
      if (!locale) return
      cfgRef.current = locale
      setCfg(locale)
      store.pulisciCacheStagione(s)
      salva(togli, locale)
    },
    [salva],
  )

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
