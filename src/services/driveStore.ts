/**
 * Ponte con il Drive del Riolunato (script Apps Script).
 *
 * Legge/scrive le raccolte dentro le 6 cartelle del Drive, divise per
 * stagione. Se `config.drive.url` è vuoto, ricade sul salvataggio nel
 * browser (localStorage), così l'app resta usabile anche senza Drive.
 */
import { config } from '../config'
import { loadCollection, loadValue, saveCollection, saveValue } from './storage'

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

// --- lettura ---

export async function list<T>(collection: string, season: string): Promise<T[]> {
  if (!DRIVE_URL) return loadCollection<T>(lsKey(collection, season))
  // lettura via POST: la chiave resta nel corpo, fuori dall'URL
  const data = await post({ action: 'list', collection, season: seasonKey(season) })
  return data.items as T[]
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
  return { stagioni: data.stagioni || [], attiva: data.attiva || '' }
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
      caricatoIl: new Date().toISOString().slice(0, 10),
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
