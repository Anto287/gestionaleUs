import type { RisultatoUisp } from './uisp'

export type RigaClassifica = { squadra: string; punti: number; giocate?: number; vinte?: number; pareggiate?: number; perse?: number; golFatti?: number; golSubiti?: number }
export type DatiClassifica = { tipo: string; righe?: RigaClassifica[]; aggiornato?: string; risultati?: RisultatoUisp[]; avvisoRisultati?: string; pdfUrl?: string; comunicato?: string; categoria?: string; girone?: string }
type Copia = { versione: 1; dati: DatiClassifica }
const prefix = 'usriolunato:classifica:v1:'
const key = (stagione: string) => prefix + stagione.replace(/\//g, '-')
/** Solo dati pubblici elaborati, mai il PDF, credenziali o loghi. */
export function leggiClassificaCache(stagione: string): DatiClassifica | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(key(stagione)) || 'null') as Copia | null
    if (c?.versione !== 1 || !['uisp', 'api'].includes(c.dati.tipo) || !Array.isArray(c.dati.righe) || !c.dati.righe.every((r) => typeof r.squadra === 'string' && Number.isFinite(r.punti))) return
    if (c.dati.tipo === 'uisp' && (typeof c.dati.pdfUrl !== 'string' || !c.dati.comunicato || !/^[1-9]$/.test(c.dati.categoria || '') || !/^[A-Z]$/.test(c.dati.girone || ''))) return
    if (c.dati.risultati && (!Array.isArray(c.dati.risultati) || !c.dati.risultati.every((r) => r && typeof r.id === 'string' && typeof r.data === 'string' && typeof r.casa === 'string' && typeof r.ospite === 'string' && Number.isFinite(r.golCasa) && Number.isFinite(r.golOspite)))) return
    return c.dati
  } catch { return }
}
export function salvaClassificaCache(stagione: string, dati: DatiClassifica) {
  try {
    if (!['uisp', 'api'].includes(dati.tipo)) { localStorage.removeItem(key(stagione)); return }
    localStorage.setItem(key(stagione), JSON.stringify({ versione: 1, dati }))
  } catch { /* Storage pieno o disabilitato: la lettura resta utilizzabile. */ }
}
export function stessoComunicato(a: DatiClassifica | undefined, b: DatiClassifica) {
  return a?.tipo === 'uisp' && b.tipo === 'uisp' && a.pdfUrl === b.pdfUrl && a.comunicato === b.comunicato && a.categoria === b.categoria && a.girone === b.girone && !!a.righe?.length
}

// Condivide le richieste tra i mount di StrictMode e le visite contemporanee.
const inCorso = new Map<string, Promise<DatiClassifica>>()
export function richiestaClassifica(key: string, load: () => Promise<DatiClassifica>) {
  const existing = inCorso.get(key)
  if (existing) return existing
  const promise = load().finally(() => inCorso.delete(key))
  inCorso.set(key, promise)
  return promise
}
