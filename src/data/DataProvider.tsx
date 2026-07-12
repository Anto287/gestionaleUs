import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Alert, Button, Result, Spin } from 'antd'
import { useSeason } from '../season/SeasonContext'
import { COLLECTIONS } from '../collections'
import * as store from '../services/driveStore'

type Store = Record<string, Array<{ id: string }>>

interface DataValue {
  getItems: <T>(collection: string) => T[]
  add: <T>(collection: string, item: Omit<T, 'id'>) => string
  update: <T>(collection: string, id: string, patch: Partial<T>) => void
  remove: (collection: string, id: string) => void
  uploadDoc: (file: File) => Promise<void>
}

const DataContext = createContext<DataValue | null>(null)

// raccolte NON divise per stagione (la cassa è continua nel tempo)
const COLLEZIONI_GLOBALI = new Set(['conti'])
const SEASON_GLOBALE = 'globale'
function seasonDi(collection: string, attiva: string): string {
  return COLLEZIONI_GLOBALI.has(collection) ? SEASON_GLOBALE : attiva
}

function leggiBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(String(reader.result).split(',')[1] ?? '')
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { attiva } = useSeason()
  const [data, setData] = useState<Store>({})
  const [stato, setStato] = useState<'loading' | 'ready' | 'error'>('loading')
  const [erroreCaricamento, setErroreCaricamento] = useState('')
  const [erroreSync, setErroreSync] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)

  const dataRef = useRef<Store>({})
  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let annullato = false
    setStato('loading')
    setErroreCaricamento('')
    ;(async () => {
      // ogni raccolta è caricata a sé: se una fallisce (es. non ancora nota
      // allo script) resta vuota, senza bloccare le altre.
      const results = await Promise.all(
        COLLECTIONS.map(async (c) => {
          try {
            return { c, items: await store.list<{ id: string }>(c, seasonDi(c, attiva)), errore: null as unknown }
          } catch (e) {
            return { c, items: [] as { id: string }[], errore: e }
          }
        }),
      )
      if (annullato) return
      if (results.every((r) => r.errore)) {
        const e = results[0]?.errore as Error | undefined
        setErroreCaricamento(String(e?.message || e || 'Errore Drive'))
        setStato('error')
        return
      }
      setData(Object.fromEntries(results.map((r) => [r.c, r.items])))
      setStato('ready')
    })()
    return () => {
      annullato = true
    }
  }, [attiva, tentativo])

  const fallita = useCallback((e: unknown) => {
    setErroreSync(String((e as Error)?.message || e))
  }, [])

  const getItems = useCallback(<T,>(c: string): T[] => (data[c] ?? []) as T[], [data])

  const add = useCallback(
    <T,>(c: string, item: Omit<T, 'id'>): string => {
      const id = crypto.randomUUID()
      const record = { ...item, id } as { id: string }
      setData((s) => ({ ...s, [c]: [...(s[c] ?? []), record] }))
      store.put(c, seasonDi(c, attiva), record).catch(fallita)
      return id
    },
    [attiva, fallita],
  )

  const update = useCallback(
    <T,>(c: string, id: string, patch: Partial<T>) => {
      const current = dataRef.current[c] ?? []
      const next = current.map((i) => (i.id === id ? { ...i, ...patch } : i))
      const aggiornato = next.find((i) => i.id === id)
      setData((s) => ({ ...s, [c]: next }))
      if (aggiornato) store.put(c, seasonDi(c, attiva), aggiornato).catch(fallita)
    },
    [attiva, fallita],
  )

  const remove = useCallback(
    (c: string, id: string) => {
      setData((s) => ({ ...s, [c]: (s[c] ?? []).filter((i) => i.id !== id) }))
      store.remove(c, seasonDi(c, attiva), id).catch(fallita)
    },
    [attiva, fallita],
  )

  const uploadDoc = useCallback(
    async (file: File) => {
      try {
        const base64 = await leggiBase64(file)
        const meta = await store.uploadDoc(attiva, file.name, file.type || 'application/octet-stream', base64)
        setData((s) => ({ ...s, documenti: [...(s.documenti ?? []), meta] }))
      } catch (e) {
        fallita(e)
      }
    },
    [attiva, fallita],
  )

  if (stato === 'loading') return <DriveSplash />
  if (stato === 'error')
    return <DriveSplash errore={erroreCaricamento} onRiprova={() => setTentativo((t) => t + 1)} />

  return (
    <DataContext.Provider value={{ getItems, add, update, remove, uploadDoc }}>
      {erroreSync && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setErroreSync(null)}
          message={`Una modifica non è stata salvata sul Drive: ${erroreSync}`}
          style={{ marginBottom: 16 }}
        />
      )}
      {children}
    </DataContext.Provider>
  )
}

function DriveSplash({ errore, onRiprova }: { errore?: string; onRiprova?: () => void }) {
  if (errore) {
    return (
      <Result
        status="warning"
        title="Non riesco a leggere i dati dal Drive"
        subTitle={errore}
        extra={
          onRiprova && (
            <Button type="primary" onClick={onRiprova}>
              Riprova
            </Button>
          )
        }
      />
    )
  }
  return (
    <div className="drive-splash">
      <Spin size="large" />
      <p className="drive-splash-text">Carico i dati dal Drive…</p>
    </div>
  )
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve stare dentro DataProvider')
  return ctx
}
