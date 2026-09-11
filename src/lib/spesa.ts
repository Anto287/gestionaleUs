/**
 * Conti delle spese condivise con un'altra società.
 *
 * Chi anticipa mette tutto di tasca sua, quindi l'altro gli deve la propria
 * parte: da qui nascono i crediti e i debiti che restano aperti finché la
 * spesa non viene saldata.
 */
import { formatEuro } from './format'
import type { SpesaCondivisa } from '../types'

export interface ContoSpesa {
  /** quota a carico nostro */
  nostra: number
  /** quota a carico dell'altra società */
  loro: number
  /**
   * quanto serve per pareggiare: positivo = ci devono dare, negativo =
   * dobbiamo dare noi. Non cambia quando la spesa viene saldata.
   */
  dovuto: number
  /** come `dovuto`, ma zero se la spesa è già saldata */
  aperto: number
}

function arrotonda(n: number): number {
  return Math.round(n * 100) / 100
}

export function contoSpesa(s: SpesaCondivisa): ContoSpesa {
  const totale = Number(s.importo) || 0
  const grezza = Number(s.percentuale)
  // senza percentuale si assume metà per uno
  const perc = Number.isFinite(grezza) ? Math.min(100, Math.max(0, grezza)) : 50
  const nostra = arrotonda((totale * perc) / 100)
  const loro = arrotonda(totale - nostra)
  const dovuto = s.anticipataDa === 'noi' ? loro : -nostra
  return { nostra, loro, dovuto, aperto: s.saldata ? 0 : dovuto }
}

/** Frase pronta per l'elenco: chi deve quanto a chi. */
export function fraseConto(s: SpesaCondivisa): string {
  const { dovuto } = contoSpesa(s)
  if (Math.abs(dovuto) < 0.005) return 'Nessun conguaglio'
  if (dovuto > 0) return `${s.societa} ci deve ${formatEuro(dovuto)}`
  return `Dobbiamo ${formatEuro(-dovuto)} a ${s.societa}`
}

export interface SaldoSocieta {
  societa: string
  /** positivo = ci devono dare, negativo = dobbiamo dare noi */
  aperto: number
  /** quante spese ancora da saldare */
  aperte: number
  /** quanto è passato in tutto da quella società (spese saldate comprese) */
  totale: number
}

export interface TotaliSpese {
  daRicevere: number
  daVersare: number
  /** differenza fra i due: quanto ci resta in mano a conti chiusi */
  netto: number
  perSocieta: SaldoSocieta[]
}

export function totaliSpese(spese: SpesaCondivisa[]): TotaliSpese {
  let daRicevere = 0
  let daVersare = 0
  const per = new Map<string, SaldoSocieta>()
  for (const s of spese) {
    const { aperto } = contoSpesa(s)
    if (aperto > 0) daRicevere += aperto
    else daVersare += -aperto
    const nome = s.societa?.trim() || 'Senza società'
    const riga = per.get(nome) ?? { societa: nome, aperto: 0, aperte: 0, totale: 0 }
    riga.aperto += aperto
    riga.totale += Number(s.importo) || 0
    if (!s.saldata) riga.aperte += 1
    per.set(nome, riga)
  }
  return {
    daRicevere: arrotonda(daRicevere),
    daVersare: arrotonda(daVersare),
    netto: arrotonda(daRicevere - daVersare),
    perSocieta: [...per.values()]
      .map((r) => ({ ...r, aperto: arrotonda(r.aperto), totale: arrotonda(r.totale) }))
      .sort((a, b) => Math.abs(b.aperto) - Math.abs(a.aperto) || a.societa.localeCompare(b.societa)),
  }
}
