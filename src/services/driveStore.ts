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
    const res = await fetch(
      `${DRIVE_URL}?action=seasons&secret=${encodeURIComponent(candidate)}`,
    )
    const data = await res.json()
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
  const u =
    `${DRIVE_URL}?action=list&collection=${encodeURIComponent(collection)}` +
    `&season=${encodeURIComponent(seasonKey(season))}&secret=${encodeURIComponent(getSecret())}`
  const res = await fetch(u)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Errore Drive')
  return data.items as T[]
}

// --- scrittura (serializzata per evitare corse) ---

let coda: Promise<unknown> = Promise.resolve()
function inCoda<T>(fn: () => Promise<T>): Promise<T> {
  const run = coda.then(fn, fn)
  coda = run.catch(() => undefined)
  return run as Promise<T>
}

async function post(body: Record<string, unknown>) {
  const res = await fetch(DRIVE_URL, {
    method: 'POST',
    // text/plain evita il preflight CORS con Apps Script
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, secret: getSecret() }),
  })
  const data = await res.json()
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
  const res = await fetch(`${DRIVE_URL}?action=seasons&secret=${encodeURIComponent(getSecret())}`)
  const data = await res.json()
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
