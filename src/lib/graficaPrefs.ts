/**
 * Stile predefinito delle grafiche IG, uno per tipo (partita del giorno,
 * risultato, mese): tema, colore accento, testo in fondo e foto di sfondo.
 * Serve perché ogni tipo riparta dal suo "vestito" senza rifarlo a mano.
 * Resta nel browser di questo dispositivo (localStorage). Il contenuto
 * (testi/posizioni di una singola grafica) NON si salva qui.
 */
export type KindGrafica = 'annuncio' | 'risultato' | 'mese'

export interface GraficaPrefs {
  tema?: 'carta' | 'notte'
  accento?: string
  piede?: string
  sfondoSrc?: string
  velo?: number
}

type Tutte = Partial<Record<KindGrafica, GraficaPrefs>>

const KEY = 'usriolunato:graficaPrefs'

function leggiTutte(): Tutte {
  try {
    const raw = localStorage.getItem(KEY)
    const obj = raw ? JSON.parse(raw) : {}
    return obj && typeof obj === 'object' ? (obj as Tutte) : {}
  } catch {
    return {}
  }
}

function scriviTutte(t: Tutte): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    /* quota piena: si tiene per la sessione corrente */
  }
}

export function leggiPrefs(kind: KindGrafica): GraficaPrefs {
  return leggiTutte()[kind] ?? {}
}

export function salvaPrefs(kind: KindGrafica, p: GraficaPrefs): void {
  const t = leggiTutte()
  t[kind] = p
  scriviTutte(t)
}

export function azzeraPrefs(kind: KindGrafica): void {
  const t = leggiTutte()
  delete t[kind]
  scriviTutte(t)
}
