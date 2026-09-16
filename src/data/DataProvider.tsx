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
import { PalloneSpinner } from '../components/PalloneSpinner'
import { useSeason } from '../season/SeasonContext'
import { COLLECTIONS } from '../collections'
import * as store from '../services/driveStore'
import { preparaCaricamento } from '../lib/immagine'

type Store = Record<string, Array<{ id: string }>>

interface DataValue {
  getItems: <T>(collection: string) => T[]
  add: <T>(collection: string, item: Omit<T, 'id'>) => string
  update: <T>(collection: string, id: string, patch: Partial<T>) => void
  remove: (collection: string, id: string) => void
  /** Rimette un record eliminato, con lo stesso id (per l'«Annulla»). */
  restore: (collection: string, item: { id: string }) => void
  /** Sostituisce l'intera raccolta (usato dall'import dei conti). */
  replaceAll: <T extends { id: string }>(collection: string, items: T[]) => void
  /** Carica un file nella cartella Documenti della stagione (vedi sotto). */
  uploadDoc: (file: File, nomeBase?: string) => Promise<store.DocMeta | undefined>
  /** Crea un Documento o Foglio Google nella cartella Documenti. */
  createDoc: (nome: string, tipo: 'documento' | 'foglio') => Promise<store.DocMeta>
  /** Rinomina un documento: il registro subito, e anche il file vero sul Drive. */
  renameDoc: (doc: store.DocMeta, nome: string) => void
  /** true mentre si sta rileggendo dal Drive (l'app intanto usa la copia locale) */
  aggiornando: boolean
}

const DataContext = createContext<DataValue | null>(null)

// raccolte NON divise per stagione: la cassa è continua nel tempo, e così
// anche i conti in sospeso con le altre società
const COLLEZIONI_GLOBALI = new Set(['conti', 'speseCondivise'])
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

/**
 * L'ultima copia letta di ogni raccolta. Se ci sono tutte, l'app si apre
 * subito con quelle e la rilettura dal Drive va in sottofondo; se ne manca
 * anche una (prima apertura, o raccolta nuova) si aspetta il Drive come
 * prima, per non mostrare pagine vuote.
 */
function copiaLocale(attiva: string): { data: Store; completa: boolean } {
  const data: Store = {}
  let trovate = 0
  for (const c of COLLECTIONS) {
    const items = store.listCache<{ id: string }>(c, seasonDi(c, attiva))
    if (items) {
      data[c] = items
      trovate++
    }
  }
  return { data, completa: trovate === COLLECTIONS.length }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { attiva } = useSeason()
  const [copia] = useState(() => copiaLocale(attiva))
  const [data, setData] = useState<Store>(copia.data)
  const [stato, setStato] = useState<'loading' | 'ready' | 'error'>(
    copia.completa ? 'ready' : 'loading',
  )
  const [erroreCaricamento, setErroreCaricamento] = useState('')
  const [erroreSync, setErroreSync] = useState<string | null>(null)
  const [aggiornando, setAggiornando] = useState(true)
  const [tentativo, setTentativo] = useState(0)

  const dataRef = useRef<Store>(copia.data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // raccolte toccate qui dentro mentre si rilegge: la risposta del Drive
  // (partita prima della modifica) non deve ributtarci sopra la versione vecchia
  const modificate = useRef(new Set<string>())
  const segnaModifica = useCallback((c: string) => {
    modificate.current.add(c)
  }, [])

  // copie locali già salvate, per riscrivere solo quello che cambia
  const salvate = useRef<Store>({ ...copia.data })

  useEffect(() => {
    let annullato = false
    modificate.current = new Set()
    setAggiornando(true)
    setErroreCaricamento('')
    // «Riprova» dopo un errore: si torna allo spinner (con la copia locale
    // in mano, invece, non si interrompe niente)
    setStato((st) => (st === 'error' ? 'loading' : st))
    ;(async () => {
      // se nel frattempo l'abbiamo modificata qui, la risposta del Drive è già
      // vecchia e non va posata sopra
      const posa = (c: string, items: { id: string }[]) => {
        if (!annullato && !modificate.current.has(c)) setData((s) => ({ ...s, [c]: items }))
      }

      // prima strada: tutte le raccolte in una richiesta sola (script aggiornato)
      try {
        const tutte = await store.listAll(
          COLLECTIONS.map((c) => ({ collection: c, season: seasonDi(c, attiva) })),
        )
        if (annullato) return
        if (tutte) {
          for (const c of COLLECTIONS) {
            // una sezione che lo script non è riuscito a leggere non c'è nella
            // risposta: si tiene quella che abbiamo, non la si svuota
            const items = tutte[c]
            if (items) posa(c, items as { id: string }[])
          }
          setAggiornando(false)
          setStato('ready')
          return
        }
      } catch {
        // niente panico: si riprova qui sotto una raccolta per volta
      }
      if (annullato) return

      // ripiego: ogni raccolta per conto suo, e si posa appena arriva (se una
      // fallisce — es. non ancora nota allo script — le altre non la aspettano)
      const esiti = await Promise.all(
        COLLECTIONS.map(async (c) => {
          try {
            posa(c, await store.list<{ id: string }>(c, seasonDi(c, attiva)))
            return { c, errore: null as unknown }
          } catch (e) {
            return { c, errore: e }
          }
        }),
      )
      if (annullato) return
      setAggiornando(false)
      if (esiti.every((r) => r.errore)) {
        const e = esiti[0]?.errore as Error | undefined
        setErroreCaricamento(String(e?.message || e || 'Errore Drive'))
        // con la copia locale in mano si continua a lavorare: l'errore blocca
        // solo chi non ha proprio niente da mostrare
        setStato((st) => (st === 'ready' ? st : 'error'))
        return
      }
      setStato('ready')
    })()
    return () => {
      annullato = true
    }
  }, [attiva, tentativo])

  // la copia locale segue quello che si vede: scritta poco dopo ogni
  // cambiamento, così la prossima apertura parte da qui
  useEffect(() => {
    if (stato !== 'ready') return
    const t = setTimeout(() => {
      for (const c of COLLECTIONS) {
        const items = data[c]
        if (items && items !== salvate.current[c]) {
          store.salvaCacheLista(c, seasonDi(c, attiva), items)
          salvate.current[c] = items
        }
      }
    }, 500)
    return () => clearTimeout(t)
  }, [data, stato, attiva])

  const fallita = useCallback((e: unknown) => {
    setErroreSync(String((e as Error)?.message || e))
  }, [])

  const getItems = useCallback(<T,>(c: string): T[] => (data[c] ?? []) as T[], [data])

  const add = useCallback(
    <T,>(c: string, item: Omit<T, 'id'>): string => {
      const id = crypto.randomUUID()
      const record = { ...item, id } as { id: string }
      segnaModifica(c)
      setData((s) => ({ ...s, [c]: [...(s[c] ?? []), record] }))
      store.put(c, seasonDi(c, attiva), record).catch(fallita)
      return id
    },
    [attiva, fallita, segnaModifica],
  )

  const update = useCallback(
    <T,>(c: string, id: string, patch: Partial<T>) => {
      const current = dataRef.current[c] ?? []
      const next = current.map((i) => (i.id === id ? { ...i, ...patch } : i))
      const aggiornato = next.find((i) => i.id === id)
      segnaModifica(c)
      setData((s) => ({ ...s, [c]: next }))
      if (aggiornato) store.put(c, seasonDi(c, attiva), aggiornato).catch(fallita)
    },
    [attiva, fallita, segnaModifica],
  )

  const remove = useCallback(
    (c: string, id: string) => {
      segnaModifica(c)
      setData((s) => ({ ...s, [c]: (s[c] ?? []).filter((i) => i.id !== id) }))
      store.remove(c, seasonDi(c, attiva), id).catch(fallita)
    },
    [attiva, fallita, segnaModifica],
  )

  const restore = useCallback(
    (c: string, item: { id: string }) => {
      // il put del Drive fa upsert per id, quindi basta riaggiungerlo com'era
      segnaModifica(c)
      setData((s) => (s[c] ?? []).some((i) => i.id === item.id) ? s : { ...s, [c]: [...(s[c] ?? []), item] })
      store.put(c, seasonDi(c, attiva), item).catch(fallita)
    },
    [attiva, fallita, segnaModifica],
  )

  const replaceAll = useCallback(
    <T extends { id: string }>(c: string, items: T[]) => {
      segnaModifica(c)
      setData((s) => ({ ...s, [c]: items }))
      store.replaceAll(c, seasonDi(c, attiva), items).catch(fallita)
    },
    [attiva, fallita, segnaModifica],
  )

  /**
   * Carica un file nella cartella Documenti della stagione.
   *
   * Con `nomeBase` il file prende quel nome (l'estensione la mette l'app) e,
   * se è un'immagine, viene rimpicciolita prima di partire: è il caso degli
   * allegati fotografati col telefono, come gli scontrini delle spese
   * condivise. Senza, il file sale com'è e col suo nome.
   */
  const uploadDoc = useCallback(
    async (file: File, nomeBase?: string): Promise<store.DocMeta | undefined> => {
      try {
        const pronto = nomeBase
          ? await preparaCaricamento(file)
          : {
              dataBase64: await leggiBase64(file),
              tipo: file.type || 'application/octet-stream',
              estensione: '',
            }
        const nome = nomeBase ? nomeBase + pronto.estensione : file.name
        const meta = await store.uploadDoc(attiva, nome, pronto.tipo, pronto.dataBase64)
        segnaModifica('documenti')
        setData((s) => ({ ...s, documenti: [...(s.documenti ?? []), meta] }))
        return meta
      } catch (e) {
        fallita(e)
        return undefined
      }
    },
    [attiva, fallita, segnaModifica],
  )

  const createDoc = useCallback(
    async (nome: string, tipo: 'documento' | 'foglio') => {
      const meta = await store.createDoc(attiva, nome, tipo)
      segnaModifica('documenti')
      setData((s) => ({ ...s, documenti: [...(s.documenti ?? []), meta] }))
      return meta
    },
    [attiva, segnaModifica],
  )

  const renameDoc = useCallback(
    (doc: store.DocMeta, nome: string) => {
      update('documenti', doc.id, { nome })
      // il file vero: nel link del Drive c'è l'id del file, più affidabile dell'id del record
      const fileId = doc.url?.match(/\/d\/([\w-]+)/)?.[1] ?? doc.id
      store.renameDoc(fileId, nome).catch(fallita)
    },
    [update, fallita],
  )

  if (stato === 'loading') return <DriveSplash />
  if (stato === 'error')
    return <DriveSplash errore={erroreCaricamento} onRiprova={() => setTentativo((t) => t + 1)} />

  return (
    <DataContext.Provider
      value={{
        getItems,
        add,
        update,
        remove,
        restore,
        replaceAll,
        uploadDoc,
        createDoc,
        renameDoc,
        aggiornando,
      }}
    >
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
      {erroreCaricamento && !aggiornando && (
        <Alert
          type="warning"
          showIcon
          message="Sto lavorando sull'ultima copia salvata sul telefono: il Drive non ha risposto."
          action={
            <Button size="small" onClick={() => setTentativo((t) => t + 1)}>
              Riprova
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {children}
      <Aggiornamento attivo={aggiornando && copia.completa} />
    </DataContext.Provider>
  )
}

/**
 * Il puntino "sto rileggendo dal Drive" in basso: compare solo se l'attesa
 * si fa sentire (l'app intanto è già tutta lì, con la copia locale).
 */
function Aggiornamento({ attivo }: { attivo: boolean }) {
  const [visibile, setVisibile] = useState(false)
  useEffect(() => {
    if (!attivo) {
      setVisibile(false)
      return
    }
    const t = setTimeout(() => setVisibile(true), 800)
    return () => clearTimeout(t)
  }, [attivo])

  if (!visibile) return null
  return (
    <div className="sync-chip" role="status">
      <Spin size="small" />
      <span>Aggiorno dal Drive…</span>
    </div>
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
      <PalloneSpinner />
      <p className="drive-splash-text">Carico i dati dal Drive…</p>
    </div>
  )
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve stare dentro DataProvider')
  return ctx
}
