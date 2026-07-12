import type { Partita } from '../types'

export interface StatGiocatore {
  gol: number
  assist: number
  ammonizioni: number
  espulsioni: number
}

/** Somma le statistiche di un giocatore da tutte le partite della stagione. */
export function statisticheGiocatore(giocatoreId: string, partite: Partita[]): StatGiocatore {
  let gol = 0
  let assist = 0
  let ammonizioni = 0
  let espulsioni = 0
  for (const p of partite) {
    for (const m of p.marcatori ?? []) if (m.giocatoreId === giocatoreId) gol += m.quantita
    for (const a of p.assist ?? []) if (a.giocatoreId === giocatoreId) assist += a.quantita
    if ((p.ammoniti ?? []).includes(giocatoreId)) ammonizioni += 1
    if ((p.espulsi ?? []).includes(giocatoreId)) espulsioni += 1
  }
  return { gol, assist, ammonizioni, espulsioni }
}
