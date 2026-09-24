/**
 * Stile predefinito delle grafiche IG, uno per tipo (partita del giorno,
 * risultato, mese): tema, colore accento, testo in fondo e foto di sfondo.
 * Serve perché ogni tipo riparta dal suo "vestito" senza rifarlo a mano.
 * Resta nel browser di questo dispositivo (localStorage). Il contenuto
 * (testi/posizioni di una singola grafica) NON si salva qui.
 */
export type KindGrafica = 'annuncio' | 'risultato' | 'mese' | 'formazione'

export interface GraficaPrefs {
  tema?: 'carta' | 'notte'
  accento?: string
  piede?: string
  sfondoSrc?: string
  velo?: number
  /** tinta unita di sfondo (senza foto) */
  sfondoColore?: string
  /** decorazioni del template */
  fascia?: boolean
  cornice?: boolean
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

/** false se il browser non l'ha salvato (es. spazio pieno per le foto di sfondo). */
function scriviTutte(t: Tutte): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
    return true
  } catch {
    return false
  }
}

export function leggiPrefs(kind: KindGrafica): GraficaPrefs {
  return leggiTutte()[kind] ?? {}
}

export function salvaPrefs(kind: KindGrafica, p: GraficaPrefs): boolean {
  const t = leggiTutte()
  t[kind] = p
  return scriviTutte(t)
}

export function azzeraPrefs(kind: KindGrafica): void {
  const t = leggiTutte()
  delete t[kind]
  scriviTutte(t)
}
