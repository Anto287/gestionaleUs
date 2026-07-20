import type { Partita } from '../types'

export interface StatGiocatore {
  gol: number
  assist: number
  ammonizioni: number
  espulsioni: number
  /** partite in cui è sceso in campo (titolare o subentrato) */
  presenzePartita: number
  /** di cui dal primo minuto */
  daTitolare: number
}

/** Somma le statistiche di un giocatore da tutte le partite della stagione. */
export function statisticheGiocatore(giocatoreId: string, partite: Partita[]): StatGiocatore {
  let gol = 0
  let assist = 0
  let ammonizioni = 0
  let espulsioni = 0
  let presenzePartita = 0
  let daTitolare = 0
  for (const p of partite) {
    for (const m of p.marcatori ?? []) if (m.giocatoreId === giocatoreId) gol += m.quantita
    for (const a of p.assist ?? []) if (a.giocatoreId === giocatoreId) assist += a.quantita
    if ((p.ammoniti ?? []).includes(giocatoreId)) ammonizioni += 1
    if ((p.espulsi ?? []).includes(giocatoreId)) espulsioni += 1
    if ((p.titolari ?? []).includes(giocatoreId)) {
      presenzePartita += 1
      daTitolare += 1
    } else if ((p.subentrati ?? []).includes(giocatoreId)) {
      presenzePartita += 1
    }
  }
  return { gol, assist, ammonizioni, espulsioni, presenzePartita, daTitolare }
}

/** Quante partite hanno le presenze segnate (per le percentuali in classifica). */
export function partiteConPresenze(partite: Partita[]): number {
  return partite.filter((p) => (p.titolari?.length ?? 0) + (p.subentrati?.length ?? 0) > 0).length
}
