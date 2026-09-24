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
import * as store from '../services/driveStore'
import { loadValue, saveValue } from '../services/storage'
import {
  agganciaArchivio,
  chiaveFile,
  chiaveTesserato,
  nascitaIso,
  type Aggancio,
  type Cartella,
  type FileArchivio,
  type SchedaArchivio,
  type Tesserato,
} from '../lib/archivio'
import { preparaCaricamento } from '../lib/immagine'
import { useData } from './DataProvider'
import type { Giocatore } from '../types'

/**
 * Archivio tesserati: le due cartelle del Drive con i documenti
 * (fronte/retro) e le foto. Vivono fuori dal gestionale — non cambiano con
 * la stagione — quindi si leggono una volta sola all'avvio e restano qui.
 *
 * Il caricamento non blocca niente: se lo script sul Drive non conosce
 * ancora l'archivio (pezzo da incollare, vedi docs/apps-script-archivio.gs)
 * lo stato resta 'assente' e le pagine si comportano come prima.
 */

type Stato = 'carico' | 'pronto' | 'assente' | 'errore'

interface ArchivioValue {
  stato: Stato
  errore: string
  documenti: FileArchivio[]
  foto: FileArchivio[]
  aggancio: Aggancio
  /** i file agganciati a un tesserato */
  scheda: (idTesserato: string) => SchedaArchivio
  /** la miniatura già scaricata di un file, se c'è */
  miniatura: (id?: string) => string | undefined
  /** chiede al Drive le miniature che mancano (a gruppetti, in sottofondo) */
  chiediMiniature: (ids: (string | undefined)[]) => void
  /** il contenuto completo di un file (anteprima e scarica) */
  contenuto: (id: string) => Promise<store.ContenutoArchivio>
  carica: (opzioni: { cartella: Cartella; base: string; file: File }) => Promise<FileArchivio>
  elimina: (file: FileArchivio) => Promise<void>
  /** in rosa c'è più di un tesserato con questo nome: serve la data di nascita */
  omonimo: (t: { nome: string; cognome: string }) => boolean
  ricarica: () => void
}

const ArchivioContext = createContext<ArchivioValue | null>(null)

const CACHE_ELENCO = store.CACHE_ARCHIVIO_ELENCO
const CACHE_MINIATURE = store.CACHE_ARCHIVIO_MINIATURE
/** una miniatura più pesante di così non va nella cache del browser */
const MAX_MINIATURA_CACHE = 80_000
const MAX_CACHE = 2_500_000
/** quante miniature chiedere per volta allo script */
const LOTTO = 12

const ARCHIVIO_VUOTO: Aggancio = { per: {}, orfani: [], omonimi: new Set() }

interface Elenco {
  documenti: FileArchivio[]
  foto: FileArchivio[]
}

/**
 * L'ultimo elenco letto resta nel browser: all'apertura l'archivio si vede
 * subito (anche con la rete del campo) e intanto si rilegge dal Drive.
 */
function leggiElenco(): Elenco | null {
  try {
    const raw = loadValue(CACHE_ELENCO)
    return raw ? (JSON.parse(raw) as Elenco) : null
  } catch {
    return null
  }
}

function salvaElenco(elenco: Elenco): void {
  try {
    saveValue(CACHE_ELENCO, JSON.stringify(elenco))
  } catch {
    /* niente cache: si legge dal Drive e basta */
  }
}

function leggiCache(): Record<string, string> {
  try {
    return JSON.parse(loadValue(CACHE_MINIATURE) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function salvaCache(miniature: Record<string, string>): void {
  try {
    const leggere = Object.fromEntries(
      Object.entries(miniature).filter(([, v]) => v.length <= MAX_MINIATURA_CACHE),
    )
    const testo = JSON.stringify(leggere)
    if (testo.length <= MAX_CACHE) saveValue(CACHE_MINIATURE, testo)
  } catch {
    /* cache piena o non disponibile: pazienza, si riscaricano */
  }
}

export function ArchivioProvider({ children }: { children: ReactNode }) {
  const { getItems } = useData()
  const giocatori = getItems<Giocatore>('giocatori')

  const [cache] = useState(leggiElenco)
  const [documenti, setDocumenti] = useState<FileArchivio[]>(cache?.documenti ?? [])
  const [foto, setFoto] = useState<FileArchivio[]>(cache?.foto ?? [])
  const [stato, setStato] = useState<Stato>(cache ? 'pronto' : 'carico')
  const [errore, setErrore] = useState('')
  const [tentativo, setTentativo] = useState(0)
  const [miniature, setMiniature] = useState<Record<string, string>>(leggiCache)

  useEffect(() => {
    let vivo = true
    setErrore('')
    store
      .archivioList()
      .then((res) => {
        if (!vivo) return
        if (!res) {
          setStato('assente') // script del Drive ancora senza il pezzo dell'archivio
          return
        }
        setDocumenti(res.documenti)
        setFoto(res.foto)
        setStato('pronto')
      })
      .catch((e) => {
        if (!vivo) return
        setErrore(String((e as Error)?.message || e))
        // con l'elenco di ieri in mano si continua a lavorare: l'errore
        // lo si segnala solo se non c'è proprio niente da mostrare
        setStato((s) => (s === 'pronto' ? 'pronto' : 'errore'))
      })
    return () => {
      vivo = false
    }
  }, [tentativo])

  const tesserati = useMemo<Tesserato[]>(
    () => giocatori.map((g) => ({ id: g.id, nome: g.nome, cognome: g.cognome, nascita: nascitaIso(g.nascita) })),
    [giocatori],
  )

  const aggancio = useMemo(
    () => (stato === 'pronto' ? agganciaArchivio(tesserati, documenti, foto) : ARCHIVIO_VUOTO),
    [stato, tesserati, documenti, foto],
  )

  // --- miniature: una coda in sottofondo, a gruppetti, senza bloccare nulla ---

  const miniatureRef = useRef(miniature)
  miniatureRef.current = miniature
  const chiesti = useRef(new Set<string>())
  const coda = useRef<string[]>([])
  const occupato = useRef(false)

  const scoda = useCallback(() => {
    if (occupato.current) return
    const lotto = coda.current.splice(0, LOTTO)
    if (!lotto.length) return
    occupato.current = true
    store
      .archivioThumbs(lotto)
      .then((thumbs) => {
        if (!thumbs.length) return
        setMiniature((m) => {
          const next = { ...m }
          for (const t of thumbs) next[t.id] = `data:${t.tipo};base64,${t.dataBase64}`
          return next
        })
      })
      .catch(() => undefined)
      .finally(() => {
        occupato.current = false
        scoda()
      })
  }, [])

  const chiediMiniature = useCallback(
    (ids: (string | undefined)[]) => {
      let nuove = false
      for (const id of ids) {
        if (!id || chiesti.current.has(id) || miniatureRef.current[id]) continue
        chiesti.current.add(id)
        coda.current.push(id)
        nuove = true
      }
      if (nuove) scoda()
    },
    [scoda],
  )

  // le foto dei tesserati in rosa servono subito: sono gli avatar
  useEffect(() => {
    if (stato !== 'pronto') return
    chiediMiniature(Object.values(aggancio.per).map((s) => s.foto?.id))
  }, [stato, aggancio, chiediMiniature])

  useEffect(() => {
    const t = setTimeout(() => salvaCache(miniature), 1500)
    return () => clearTimeout(t)
  }, [miniature])

  useEffect(() => {
    if (stato === 'pronto') salvaElenco({ documenti, foto })
  }, [stato, documenti, foto])

  // --- azioni ---

  const contenuti = useRef(new Map<string, store.ContenutoArchivio>())
  const contenuto = useCallback(async (id: string) => {
    const avuto = contenuti.current.get(id)
    if (avuto) return avuto
    const c = await store.archivioFile(id)
    contenuti.current.set(id, c)
    return c
  }, [])

  const carica = useCallback(
    async ({ cartella, base, file }: { cartella: Cartella; base: string; file: File }) => {
      const pronto = await preparaCaricamento(file)
      const nome = base + pronto.estensione
      const item = await store.archivioUpload(cartella, nome, pronto.tipo, pronto.dataBase64)
      // lo script ha già cestinato l'omonimo: qui si rifà lo stesso in elenco
      const sostituisci = (arr: FileArchivio[]) => [
        ...arr.filter((f) => f.id !== item.id && chiaveFile(f.nome) !== chiaveFile(nome)),
        item,
      ]
      if (cartella === 'foto') setFoto(sostituisci)
      else setDocumenti(sostituisci)
      // si vede subito quello appena caricato, senza aspettare il Drive
      const anteprima = `data:${pronto.tipo};base64,${pronto.dataBase64}`
      contenuti.current.set(item.id, pronto)
      if (pronto.tipo.startsWith('image/')) {
        setMiniature((m) => ({ ...m, [item.id]: anteprima }))
        chiesti.current.add(item.id)
      }
      return item
    },
    [],
  )

  const elimina = useCallback(async (file: FileArchivio) => {
    await store.archivioDelete(file.id)
    setDocumenti((a) => a.filter((f) => f.id !== file.id))
    setFoto((a) => a.filter((f) => f.id !== file.id))
    contenuti.current.delete(file.id)
    chiesti.current.delete(file.id)
    setMiniature((m) => {
      if (!m[file.id]) return m
      const next = { ...m }
      delete next[file.id]
      return next
    })
  }, [])

  const valore = useMemo<ArchivioValue>(
    () => ({
      stato,
      errore,
      documenti,
      foto,
      aggancio,
      scheda: (id) => aggancio.per[id] ?? { altri: [] },
      miniatura: (id) => (id ? miniature[id] : undefined),
      chiediMiniature,
      contenuto,
      carica,
      elimina,
      omonimo: (t) => aggancio.omonimi.has(chiaveTesserato(t)),
      ricarica: () => setTentativo((n) => n + 1),
    }),
    [stato, errore, documenti, foto, aggancio, miniature, chiediMiniature, contenuto, carica, elimina],
  )

  return <ArchivioContext.Provider value={valore}>{children}</ArchivioContext.Provider>
}

export function useArchivio(): ArchivioValue {
  const ctx = useContext(ArchivioContext)
  if (!ctx) throw new Error('useArchivio deve stare dentro ArchivioProvider')
  return ctx
}
