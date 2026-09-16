/**
 * Ponte con il Drive del Riolunato (script Apps Script).
 *
 * Legge/scrive le raccolte dentro le 6 cartelle del Drive, divise per
 * stagione. Se `config.drive.url` è vuoto, ricade sul salvataggio nel
 * browser (localStorage), così l'app resta usabile anche senza Drive.
 */
import { config } from '../config'
import {
  keysWithPrefix,
  loadCollection,
  loadValue,
  removeValue,
  saveCollection,
  saveValue,
} from './storage'
import { chiaveFile } from '../lib/archivio'
import type { Cartella, FileArchivio } from '../lib/archivio'
import { oggiIso } from '../lib/format'

const DRIVE_URL: string = config.drive.url
const SECRET_KEY = '__secret'

/**
 * La chiave d'accesso al Drive NON sta nel codice: viene inserita al login
 * e salvata nel browser di ogni dispositivo. È di fatto la password dell'app.
 */
export function getSecret(): string {
  return loadValue(SECRET_KEY) ?? ''
}
export function setSecret(s: string): void {
  saveValue(SECRET_KEY, s)
}
export function clearSecret(): void {
  saveValue(SECRET_KEY, '')
}

/** Verifica una chiave candidata chiamando il Drive. */
export async function testSecret(candidate: string): Promise<boolean> {
  if (!DRIVE_URL) return true
  try {
    // la chiave va nel CORPO (POST), non nell'URL: non finisce così in
    // cronologia, log dei proxy o header Referer.
    const data = await callDrive({ action: 'seasons', secret: candidate.trim() })
    // chiave giusta: ok:true (script aggiornato) oppure "azione sconosciuta"
    // (script vecchio, ma il controllo chiave è passato). Chiave errata: "non autorizzato".
    if (data.ok) return true
    return String(data.error || '').toLowerCase().includes('sconosciuta')
  } catch {
    return false
  }
}

/** I nomi delle cartelle non possono contenere "/". */
function seasonKey(season: string): string {
  return season.replace(/\//g, '-')
}
function lsKey(collection: string, season: string): string {
  return `${season}/${collection}`
}

export function driveAttivo(): boolean {
  return !!DRIVE_URL
}

export interface DocMeta {
  id: string
  nome: string
  tipo: string
  dimensione: number
  caricatoIl: string
  url?: string
  dataUrl?: string
}

// --- copia locale delle raccolte ---
//
// Ogni lettura riuscita lascia una copia nel browser: alla riapertura l'app
// parte da lì (subito, anche con la rete del campo) e intanto rilegge dal
// Drive in sottofondo. È solo una copia: la verità resta sul Drive.

const CACHE_DATI = '__dati/'

function cacheKey(collection: string, season: string): string {
  return `${CACHE_DATI}${season}/${collection}`
}

/** L'ultima copia letta di una raccolta, o null se non c'è. */
export function listCache<T>(collection: string, season: string): T[] | null {
  if (!DRIVE_URL) return null
  try {
    const raw = loadValue(cacheKey(collection, season))
    if (!raw) return null
    const items = JSON.parse(raw)
    return Array.isArray(items) ? (items as T[]) : null
  } catch {
    return null
  }
}

/** Aggiorna la copia locale di una raccolta (dopo una lettura o una modifica). */
export function salvaCacheLista(collection: string, season: string, items: unknown[]): void {
  if (!DRIVE_URL) return
  try {
    saveValue(cacheKey(collection, season), JSON.stringify(items))
  } catch {
    /* spazio finito: pazienza, la prossima volta si legge dal Drive */
  }
}

/**
 * Svuota tutte le copie locali delle raccolte. Si chiama uscendo dall'app:
 * sono dati dei tesserati, non devono restare sul dispositivo di chi ha
 * fatto logout (come per l'archivio).
 */
export function pulisciCacheDati(): void {
  for (const k of keysWithPrefix(CACHE_DATI)) removeValue(k)
}

// --- lettura ---

export async function list<T>(collection: string, season: string): Promise<T[]> {
  if (!DRIVE_URL) return loadCollection<T>(lsKey(collection, season))
  // lettura via POST: la chiave resta nel corpo, fuori dall'URL
  const data = await post({ action: 'list', collection, season: seasonKey(season) })
  return (data.items ?? []) as T[]
}

export interface Richiesta {
  collection: string
  season: string
}

/**
 * Tutte le raccolte in UNA sola richiesta (azione 'listAll').
 *
 * Ogni chiamata allo script è un'esecuzione a sé sul Drive: avviarne sedici
 * costa molto più dei dati che riportano indietro (Google le mette anche in
 * fila fra loro). Con una sola richiesta lo script apre i fogli di seguito e
 * risponde una volta.
 *
 * Restituisce `null` se lo script è ancora la versione vecchia, che non
 * conosce l'azione: in quel caso il chiamante torna alle letture una per una.
 */
export async function listAll(
  richieste: Richiesta[],
): Promise<Record<string, unknown[]> | null> {
  if (!DRIVE_URL) return null
  const data = await callDrive({
    action: 'listAll',
    richieste: richieste.map((r) => ({ collection: r.collection, season: seasonKey(r.season) })),
    secret: getSecret(),
  })
  if (!data.ok) {
    if (String(data.error || '').toLowerCase().includes('sconosciuta')) return null
    throw new Error(data.error || 'Errore Drive')
  }
  const liste = (data.liste ?? []) as Array<{ collection: string; items?: unknown[] }>
  return Object.fromEntries(liste.map((l) => [l.collection, l.items ?? []]))
}

// --- scrittura (serializzata per evitare corse) ---

let coda: Promise<unknown> = Promise.resolve()
function inCoda<T>(fn: () => Promise<T>): Promise<T> {
  const run = coda.then(fn, fn)
  coda = run.catch(() => undefined)
  return run as Promise<T>
}

/**
 * Chiamata grezza al Drive: POST con la chiave nel corpo (mai nell'URL).
 * Il text/plain evita il preflight CORS con Apps Script. Restituisce la
 * risposta così com'è, senza lanciare: usato da chi deve leggerne l'esito
 * (es. testSecret / seasonsConfig).
 */
async function callDrive(body: Record<string, unknown>) {
  const res = await fetch(DRIVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  })
  return res.json()
}

/** Come callDrive, ma inietta la chiave salvata e lancia se il Drive risponde con errore. */
async function post(body: Record<string, unknown>) {
  const data = await callDrive({ ...body, secret: getSecret() })
  if (!data.ok) throw new Error(data.error || 'Errore Drive')
  return data
}

export function put<T extends { id: string }>(collection: string, season: string, record: T): Promise<T> {
  if (!DRIVE_URL) {
    const k = lsKey(collection, season)
    const arr = loadCollection<T>(k)
    const i = arr.findIndex((x) => x.id === record.id)
    if (i >= 0) arr[i] = record
    else arr.push(record)
    saveCollection(k, arr)
    return Promise.resolve(record)
  }
  return inCoda(async () => {
    await post({ action: 'put', collection, season: seasonKey(season), record })
    return record
  })
}

/** Sostituisce TUTTA la raccolta in un colpo solo (usato dall'import dei conti). */
export function replaceAll<T extends { id: string }>(
  collection: string,
  season: string,
  records: T[],
): Promise<void> {
  if (!DRIVE_URL) {
    saveCollection(lsKey(collection, season), records)
    return Promise.resolve()
  }
  return inCoda(async () => {
    await post({ action: 'putAll', collection, season: seasonKey(season), records })
  })
}

export function remove(collection: string, season: string, id: string): Promise<void> {
  if (!DRIVE_URL) {
    const k = lsKey(collection, season)
    saveCollection(k, loadCollection<{ id: string }>(k).filter((x) => x.id !== id))
    return Promise.resolve()
  }
  return inCoda(async () => {
    await post({ action: 'delete', collection, season: seasonKey(season), id })
  })
}

// --- elenco stagioni (condiviso sul Drive, foglio "Stagioni") ---

const SEASONS_CFG_KEY = '__stagioni_cfg'

export interface SeasonsConfig {
  stagioni: string[]
  attiva: string
}

/**
 * Legge l'elenco stagioni dal Drive. Restituisce `null` se lo script non
 * conosce ancora l'azione (versione vecchia dello script): in quel caso
 * l'app funziona a stagione singola finché lo script non viene aggiornato.
 */
export async function seasonsConfig(): Promise<SeasonsConfig | null> {
  if (!DRIVE_URL) {
    const raw = loadValue(SEASONS_CFG_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as SeasonsConfig
      } catch {
        /* ignore */
      }
    }
    return { stagioni: [], attiva: '' }
  }
  const data = await callDrive({ action: 'seasons', secret: getSecret() })
  if (!data.ok) {
    if (String(data.error || '').toLowerCase().includes('sconosciuta')) return null
    throw new Error(data.error || 'Errore Drive')
  }
  const cfg: SeasonsConfig = { stagioni: data.stagioni || [], attiva: data.attiva || '' }
  saveValue(SEASONS_CFG_KEY, JSON.stringify(cfg))
  return cfg
}

/**
 * L'elenco stagioni dell'ultima volta, letto dal browser: serve ad aprire
 * l'app senza aspettare il Drive (poi `seasonsConfig` lo rinfresca).
 */
export function seasonsConfigCache(): SeasonsConfig | null {
  try {
    const raw = loadValue(SEASONS_CFG_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw) as SeasonsConfig
    return cfg?.stagioni?.length ? cfg : null
  } catch {
    return null
  }
}

export function setSeasonsConfig(stagioni: string[], attiva: string): Promise<void> {
  if (!DRIVE_URL) {
    saveValue(SEASONS_CFG_KEY, JSON.stringify({ stagioni, attiva }))
    return Promise.resolve()
  }
  return inCoda(async () => {
    await post({ action: 'setSeasons', stagioni, attiva })
  })
}

/**
 * Crea un documento vero sul Drive (Documento o Foglio Google) nella
 * cartella Documenti della stagione. Solo in modalità Drive.
 */
export function createDoc(
  season: string,
  nome: string,
  tipo: 'documento' | 'foglio',
): Promise<DocMeta> {
  if (!DRIVE_URL) {
    return Promise.reject(new Error('Per creare documenti serve il Drive collegato'))
  }
  return inCoda(async () => {
    const data = await post({ action: 'createDoc', season: seasonKey(season), nome, tipo })
    return data.item as DocMeta
  })
}

/**
 * Rinomina il file vero sul Drive (azione 'renameDoc' dello script). Il
 * record nel registro lo aggiorna già il chiamante con la normale put; se
 * lo script non conosce ancora l'azione, il nome cambia solo nell'app e il
 * file sul Drive resta com'era, senza segnalare errore.
 */
export function renameDoc(fileId: string, nome: string): Promise<void> {
  if (!DRIVE_URL) return Promise.resolve()
  return inCoda(async () => {
    const data = await callDrive({ action: 'renameDoc', id: fileId, nome, secret: getSecret() })
    if (!data.ok && !String(data.error || '').toLowerCase().includes('sconosciuta')) {
      throw new Error(data.error || 'Errore Drive')
    }
  })
}

/**
 * Chiede allo script il PDF "di stampa" di un file (azione 'exportPdf'):
 * Documenti/Fogli Google e file Office vengono convertiti come fa Stampa,
 * i PDF caricati tornano come sono. Restituisce i byte in base64, oppure
 * null se lo script non conosce ancora l'azione (versione vecchia): in quel
 * caso il chiamante ripiega sul visualizzatore di Google.
 */
export async function exportPdf(fileId: string): Promise<string | null> {
  if (!DRIVE_URL) return null
  const data = await callDrive({ action: 'exportPdf', id: fileId, secret: getSecret() })
  if (!data.ok) {
    if (String(data.error || '').toLowerCase().includes('sconosciuta')) return null
    throw new Error(data.error || 'Errore Drive')
  }
  return (data.dataBase64 as string) || null
}

/**
 * Salva una grafica (PNG) nella cartella "Grafica" della cartella madre del
 * Drive (accanto alle stagioni). Serve lo script aggiornato con l'azione
 * 'uploadGrafica'. Restituisce i metadati del file (con l'url).
 */
export function uploadGrafica(nome: string, dataBase64: string): Promise<DocMeta> {
  if (!DRIVE_URL) {
    return Promise.reject(new Error('Per salvare su Drive serve il Drive collegato'))
  }
  return inCoda(async () => {
    const data = await post({ action: 'uploadGrafica', nome, dataBase64 })
    return data.item as DocMeta
  })
}

export function uploadDoc(
  season: string,
  nome: string,
  tipo: string,
  dataBase64: string,
): Promise<DocMeta> {
  if (!DRIVE_URL) {
    const k = lsKey('documenti', season)
    const arr = loadCollection<DocMeta>(k)
    const rec: DocMeta = {
      id: crypto.randomUUID(),
      nome,
      tipo,
      dimensione: Math.round(dataBase64.length * 0.75),
      caricatoIl: oggiIso(),
      dataUrl: `data:${tipo};base64,${dataBase64}`,
    }
    arr.push(rec)
    saveCollection(k, arr)
    return Promise.resolve(rec)
  }
  return inCoda(async () => {
    const data = await post({ action: 'upload', season: seasonKey(season), nome, tipo, dataBase64 })
    return data.item as DocMeta
  })
}

// --- archivio tesserati (le due cartelle fuori dal gestionale) ---
//
// Documenti e foto dei tesserati stanno in due cartelle loro, altrove sul
// Drive: non c'entrano con la stagione e non vengono toccate dalle altre
// funzioni. Restano private (niente condivisione via link): i contenuti
// passano da qui, chiesti allo script solo quando servono.

/**
 * Copie locali dell'archivio, tenute dal browser per aprirlo subito:
 * l'elenco dei file e le miniature. Le chiavi stanno qui perché servono
 * anche all'uscita, quando vanno cancellate.
 */
export const CACHE_ARCHIVIO_ELENCO = '__archivio_elenco'
export const CACHE_ARCHIVIO_MINIATURE = '__archivio_miniature'

/**
 * Svuota le copie locali dell'archivio. Si chiama uscendo dall'app: sono
 * nomi e miniature di documenti d'identità, non devono restare sul
 * dispositivo di chi ha fatto logout.
 */
export function pulisciCacheArchivio(): void {
  removeValue(CACHE_ARCHIVIO_ELENCO)
  removeValue(CACHE_ARCHIVIO_MINIATURE)
}

/** Miniatura di un file dell'archivio (quella già pronta sul Drive). */
export interface MiniaturaArchivio {
  id: string
  tipo: string
  dataBase64: string
}

export interface ContenutoArchivio {
  tipo: string
  dataBase64: string
}

function archivioKey(cartella: Cartella): string {
  return `__archivio/${cartella}`
}

/**
 * Elenco dei file delle due cartelle. Restituisce `null` se lo script non
 * conosce ancora l'archivio (versione da aggiornare con il pezzo in
 * docs/apps-script-archivio.gs): in quel caso l'app fa finta di niente.
 */
export async function archivioList(): Promise<{ documenti: FileArchivio[]; foto: FileArchivio[] } | null> {
  if (!DRIVE_URL) {
    return {
      documenti: loadCollection<FileArchivio>(archivioKey('documenti')),
      foto: loadCollection<FileArchivio>(archivioKey('foto')),
    }
  }
  const data = await callDrive({ action: 'archivioList', secret: getSecret() })
  if (!data.ok) {
    if (String(data.error || '').toLowerCase().includes('sconosciuta')) return null
    throw new Error(data.error || 'Errore Drive')
  }
  return { documenti: (data.documenti || []) as FileArchivio[], foto: (data.foto || []) as FileArchivio[] }
}

/** Le miniature di un gruppo di file (per gli avatar della rosa). */
export async function archivioThumbs(ids: string[]): Promise<MiniaturaArchivio[]> {
  if (!ids.length) return []
  if (!DRIVE_URL) {
    // senza Drive (sviluppo) la "miniatura" è il file stesso salvato nel browser
    const tutti = [
      ...loadCollection<FileArchivio>(archivioKey('documenti')),
      ...loadCollection<FileArchivio>(archivioKey('foto')),
    ]
    return tutti
      .filter((f) => f.dataUrl && ids.includes(f.id))
      .map((f) => ({ id: f.id, tipo: f.tipo, dataBase64: f.dataUrl?.split(',')[1] ?? '' }))
  }
  const data = await callDrive({ action: 'archivioThumbs', ids, secret: getSecret() })
  if (!data.ok) return []
  return (data.thumbs || []) as MiniaturaArchivio[]
}

/** Il contenuto di un file dell'archivio (anteprima e scarica). */
export async function archivioFile(id: string): Promise<ContenutoArchivio> {
  if (!DRIVE_URL) {
    const tutti = [
      ...loadCollection<FileArchivio>(archivioKey('documenti')),
      ...loadCollection<FileArchivio>(archivioKey('foto')),
    ]
    const f = tutti.find((x) => x.id === id)
    if (!f?.dataUrl) throw new Error('file non trovato')
    return { tipo: f.tipo, dataBase64: f.dataUrl.split(',')[1] ?? '' }
  }
  const data = await post({ action: 'archivioFile', id })
  return { tipo: String(data.tipo || ''), dataBase64: String(data.dataBase64 || '') }
}

/**
 * Carica (o sostituisce) un file nell'archivio: se ce n'è già uno con lo
 * stesso nome finisce nel cestino, così resta una copia sola.
 */
export function archivioUpload(
  cartella: Cartella,
  nome: string,
  tipo: string,
  dataBase64: string,
): Promise<FileArchivio> {
  if (!DRIVE_URL) {
    const k = archivioKey(cartella)
    const arr = loadCollection<FileArchivio>(k).filter((f) => chiaveFile(f.nome) !== chiaveFile(nome))
    const rec: FileArchivio = {
      id: crypto.randomUUID(),
      nome,
      tipo,
      dimensione: Math.round(dataBase64.length * 0.75),
      caricatoIl: oggiIso(),
      dataUrl: `data:${tipo};base64,${dataBase64}`,
    }
    arr.push(rec)
    saveCollection(k, arr)
    return Promise.resolve(rec)
  }
  return inCoda(async () => {
    const data = await post({ action: 'archivioUpload', cartella, nome, tipo, dataBase64 })
    return data.item as FileArchivio
  })
}

/** Cestina un file dell'archivio (l'app lo chiede sempre con una conferma). */
export function archivioDelete(id: string): Promise<void> {
  if (!DRIVE_URL) {
    for (const c of ['documenti', 'foto'] as Cartella[]) {
      const k = archivioKey(c)
      saveCollection(k, loadCollection<FileArchivio>(k).filter((f) => f.id !== id))
    }
    return Promise.resolve()
  }
  return inCoda(async () => {
    await post({ action: 'archivioDelete', id })
  })
}
