import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Alert, Button, Result, Spin } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { SyncGuard } from '../lib/syncGuard'
import { riusaLista } from '../lib/riusaLista'
import { PalloneSpinner } from '../components/PalloneSpinner'
import { useSeason } from '../season/SeasonContext'
import { COLLECTIONS } from '../collections'
import * as store from '../services/driveStore'
import { preparaCaricamento } from '../lib/immagine'
import { useChiudiUndoAlloSmontaggio } from '../hooks/useEliminaUndo'

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
  uploadDoc: (
    file: File,
    nomeBase?: string,
  ) => Promise<store.DocMeta | undefined>
  /** Crea un Documento o Foglio Google nella cartella Documenti. */
  createDoc: (
    nome: string,
    tipo: 'documento' | 'foglio',
  ) => Promise<store.DocMeta>
  /** Rinomina un documento: il registro subito, e anche il file vero sul Drive. */
  renameDoc: (doc: store.DocMeta, nome: string) => void
}

const DataContext = createContext<DataValue | null>(null)
// Solo l’archivio ha bisogno del segnale di refresh: i cambi di stato del Drive
// non devono invalidare tutti i consumatori dei dati nelle pagine.
const SyncVersionContext = createContext(0)
export function useDataSyncVersion(): number {
  return useContext(SyncVersionContext)
}

// raccolte NON divise per stagione: la cassa è continua nel tempo, e così
// anche i conti in sospeso con le altre società e le schede degli avversari
// (si ritrovano l'anno dopo)
const COLLEZIONI_GLOBALI = new Set(['conti', 'speseCondivise', 'avversari'])
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
  const [versioneSync, setVersioneSync] = useState(0)
  const [ultimoAggiornamento, setUltimoAggiornamento] = useState<Date | null>(
    null,
  )
  const [online, setOnline] = useState(navigator.onLine)
  const refreshRef = useRef<() => void>(() => {})
  // cambiando stagione il provider si smonta: niente «Annulla» verso quello vecchio
  useChiudiUndoAlloSmontaggio()

  const dataRef = useRef<Store>(copia.data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // raccolte toccate qui dentro mentre si rilegge: la risposta del Drive
  // (partita prima della modifica) non deve ributtarci sopra la versione vecchia
  const guard = useRef(new SyncGuard())
  const segnaModifica = useCallback((c: string) => guard.current.changed(c), [])

  // copie locali già salvate, per riscrivere solo quello che cambia
  const salvate = useRef<Store>({ ...copia.data })

  useEffect(() => {
    let annullato = false
    let inCorso = false
    let ultimoAvvio = 0
    let timer: ReturnType<typeof setTimeout>

    async function aggiorna(forza = false) {
      if (annullato || inCorso) return
      if (
        !forza &&
        (document.visibilityState === 'hidden' ||
          Date.now() - ultimoAvvio < 5000)
      )
        return
      clearTimeout(timer)
      if (!navigator.onLine && store.driveAttivo()) {
        setAggiornando(false)
        setErroreCaricamento('Connessione assente')
        setStato((st) => (st === 'ready' ? st : 'error'))
        return
      }
      inCorso = true
      ultimoAvvio = Date.now()
      const snapshot = guard.current.snapshot()
      setAggiornando(true)
      setStato((st) => (st === 'error' ? 'loading' : st))
      const posa = (c: string, items: { id: string }[]) => {
        if (!annullato && guard.current.canApply(c, snapshot)) {
          const condivisi = riusaLista(dataRef.current[c], items)
          if (condivisi === dataRef.current[c]) return
          dataRef.current = { ...dataRef.current, [c]: condivisi }
          setData((s) => ({ ...s, [c]: condivisi }))
        }
      }
      try {
        let tutte: Record<string, unknown[]> | null = null
        try {
          tutte = await store.listAll(
            COLLECTIONS.map((c) => ({
              collection: c,
              season: seasonDi(c, attiva),
            })),
          )
        } catch {
          /* riprova le singole raccolte, come con lo script precedente */
        }
        if (annullato) return
        const esiti = await Promise.all(
          COLLECTIONS.map(async (c) => {
            try {
              const items =
                tutte?.[c] ??
                (await store.list<{ id: string }>(c, seasonDi(c, attiva)))
              posa(c, items as { id: string }[])
              return null
            } catch (e) {
              return e
            }
          }),
        )
        if (annullato) return
        const errori = esiti.filter(Boolean)
        setErroreCaricamento(
          errori.length
            ? 'Alcuni dati non sono stati aggiornati dal Drive.'
            : '',
        )
        if (!errori.length) setUltimoAggiornamento(new Date())
        setVersioneSync((v) => v + 1)
        setStato((st) =>
          errori.length === COLLECTIONS.length && st !== 'ready'
            ? 'error'
            : 'ready',
        )
      } finally {
        inCorso = false
        if (!annullato) {
          setAggiornando(false)
          // Una sola richiesta alla volta. I tab nascosti non interrogano Drive.
          timer = setTimeout(() => {
            void aggiorna()
          }, 60_000)
        }
      }
    }
    const rientro = () => {
      void aggiorna()
    }
    const connessione = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void aggiorna(true)
    }
    refreshRef.current = () => {
      void aggiorna(true)
    }
    void aggiorna(true)
    window.addEventListener('focus', rientro)
    document.addEventListener('visibilitychange', rientro)
    window.addEventListener('online', connessione)
    window.addEventListener('offline', connessione)
    return () => {
      annullato = true
      clearTimeout(timer)
      window.removeEventListener('focus', rientro)
      document.removeEventListener('visibilitychange', rientro)
      window.removeEventListener('online', connessione)
      window.removeEventListener('offline', connessione)
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

  // Conserva le scritture non confermate, così «Riprova salvataggio» è sicuro
  // anche se nel frattempo lo stesso movimento viene modificato di nuovo.
  const scritture = useRef(
    new Map<
      string,
      { c: string; task: () => Promise<unknown>; fallita: boolean }
    >(),
  )
  const [riprovando, setRiprovando] = useState(false)
  const scrivi = useCallback(
    async (c: string, id: string, task: () => Promise<unknown>) => {
      const key = `${c}/${id}`
      const voce = { c, task, fallita: false }
      scritture.current.set(key, voce)
      try {
        await guard.current.write(c, task)
        if (scritture.current.get(key) === voce) scritture.current.delete(key)
      } catch (e) {
        voce.fallita = true
        fallita(e)
      } finally {
        if (![...scritture.current.values()].some((v) => v.c === c))
          guard.current.confirmed(c)
        if (!scritture.current.size) setErroreSync(null)
      }
    },
    [fallita],
  )
  const riprovaScritture = async () => {
    setRiprovando(true)
    try {
      await store.attendiScritture()
      for (const [key, voce] of [...scritture.current]) {
        if (voce.fallita && scritture.current.get(key) === voce) {
          await scrivi(voce.c, key.slice(voce.c.length + 1), voce.task)
        }
      }
    } finally {
      setRiprovando(false)
    }
  }

  const getItems = useCallback(
    <T,>(c: string): T[] => (data[c] ?? []) as T[],
    [data],
  )

  // applica una modifica a una raccolta: allo stato e SUBITO anche a dataRef,
  // così due chiamate di fila nello stesso gestore vedono l'una l'effetto dell'altra
  const cambia = useCallback(
    (c: string, f: (items: Array<{ id: string }>) => Array<{ id: string }>) => {
      dataRef.current = { ...dataRef.current, [c]: f(dataRef.current[c] ?? []) }
      setData((s) => ({ ...s, [c]: f(s[c] ?? []) }))
    },
    [],
  )

  const add = useCallback(
    <T,>(c: string, item: Omit<T, 'id'>): string => {
      const id = crypto.randomUUID()
      const record = { ...item, id } as { id: string }
      segnaModifica(c)
      cambia(c, (items) => [...items, record])
      void scrivi(c, id, () => store.put(c, seasonDi(c, attiva), record))
      return id
    },
    [attiva, scrivi, segnaModifica, cambia],
  )

  const update = useCallback(
    <T,>(c: string, id: string, patch: Partial<T>) => {
      const applica = (items: Array<{ id: string }>) =>
        items.map((i) => (i.id === id ? { ...i, ...patch } : i))
      segnaModifica(c)
      cambia(c, applica)
      const aggiornato = (dataRef.current[c] ?? []).find((i) => i.id === id)
      if (aggiornato)
        void scrivi(c, id, () => store.put(c, seasonDi(c, attiva), aggiornato))
    },
    [attiva, scrivi, segnaModifica, cambia],
  )

  const remove = useCallback(
    (c: string, id: string) => {
      segnaModifica(c)
      cambia(c, (items) => items.filter((i) => i.id !== id))
      void scrivi(c, id, () => store.remove(c, seasonDi(c, attiva), id))
    },
    [attiva, scrivi, segnaModifica, cambia],
  )

  const restore = useCallback(
    (c: string, item: { id: string }) => {
      // il put del Drive fa upsert per id, quindi basta riaggiungerlo com'era
      segnaModifica(c)
      cambia(c, (items) =>
        items.some((i) => i.id === item.id) ? items : [...items, item],
      )
      void scrivi(c, item.id, () => store.put(c, seasonDi(c, attiva), item))
    },
    [attiva, scrivi, segnaModifica, cambia],
  )

  const replaceAll = useCallback(
    <T extends { id: string }>(c: string, items: T[]) => {
      segnaModifica(c)
      cambia(c, () => items)
      for (const [key, voce] of scritture.current)
        if (voce.c === c) scritture.current.delete(key)
      void scrivi(c, '*', () =>
        store.replaceAll(c, seasonDi(c, attiva), dataRef.current[c] ?? []),
      )
    },
    [attiva, scrivi, segnaModifica, cambia],
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
    async (
      file: File,
      nomeBase?: string,
    ): Promise<store.DocMeta | undefined> => {
      try {
        const pronto = nomeBase
          ? await preparaCaricamento(file)
          : {
              dataBase64: await leggiBase64(file),
              tipo: file.type || 'application/octet-stream',
              estensione: '',
            }
        const nome = nomeBase ? nomeBase + pronto.estensione : file.name
        const meta = await store.uploadDoc(
          attiva,
          nome,
          pronto.tipo,
          pronto.dataBase64,
        )
        segnaModifica('documenti')
        cambia('documenti', (items) => [...items, meta])
        return meta
      } catch (e) {
        fallita(e)
        return undefined
      }
    },
    [attiva, fallita, segnaModifica, cambia],
  )

  const createDoc = useCallback(
    async (nome: string, tipo: 'documento' | 'foglio') => {
      const meta = await store.createDoc(attiva, nome, tipo)
      segnaModifica('documenti')
      cambia('documenti', (items) => [...items, meta])
      return meta
    },
    [attiva, segnaModifica, cambia],
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

  const valore = useMemo<DataValue>(
    () => ({
      getItems,
      add,
      update,
      remove,
      restore,
      replaceAll,
      uploadDoc,
      createDoc,
      renameDoc,
    }),
    [
      getItems,
      add,
      update,
      remove,
      restore,
      replaceAll,
      uploadDoc,
      createDoc,
      renameDoc,
    ],
  )

  if (stato === 'loading') return <DriveSplash />
  if (stato === 'error')
    return (
      <DriveSplash
        errore={erroreCaricamento}
        onRiprova={() => setTentativo((t) => t + 1)}
      />
    )

  return (
    <DataContext.Provider value={valore}>
      <SyncVersionContext.Provider value={versioneSync}>
        {erroreSync && (
          <Alert
            type="warning"
            showIcon
            message={`Una modifica non è stata salvata sul Drive: ${erroreSync}`}
            description={
              scritture.current.size
                ? 'Le modifiche locali restano visibili. Riprova il salvataggio prima di chiudere l’app.'
                : 'Riprova il caricamento dalla sua finestra.'
            }
            closable={!scritture.current.size}
            onClose={() => setErroreSync(null)}
            action={
              scritture.current.size ? (
                <Button
                  size="small"
                  loading={riprovando}
                  disabled={!online}
                  onClick={riprovaScritture}
                >
                  Riprova salvataggio
                </Button>
              ) : undefined
            }
            style={{ marginBottom: 16 }}
          />
        )}
        {erroreCaricamento && !aggiornando && (
          <Alert
            type="warning"
            showIcon
            message="Alcuni dati potrebbero non essere aggiornati: mostro l’ultima copia disponibile."
            action={
              <Button size="small" onClick={() => setTentativo((t) => t + 1)}>
                Riprova
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <div className="sync-status" role="status" aria-live="polite">
          <span>
            {!store.driveAttivo()
              ? 'Modalità locale'
              : !online
                ? 'Offline'
                : aggiornando
                  ? 'Aggiornamento dal Drive…'
                  : erroreCaricamento
                    ? 'Aggiornamento incompleto'
                    : ultimoAggiornamento
                      ? `Aggiornato alle ${ultimoAggiornamento.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Dati locali'}
          </span>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={aggiornando}
            disabled={!online}
            onClick={() => refreshRef.current()}
          >
            Aggiorna
          </Button>
        </div>
        {children}
        <Aggiornamento attivo={aggiornando && copia.completa} />
      </SyncVersionContext.Provider>
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

function DriveSplash({
  errore,
  onRiprova,
}: {
  errore?: string
  onRiprova?: () => void
}) {
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
