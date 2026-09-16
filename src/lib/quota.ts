/**
 * Stato della quota associativa di un giocatore. Se è impostato l'importo
 * della quota (quotaImporto), lo stato deriva dalla somma dei versamenti;
 * altrimenti vale il vecchio interruttore pagata/non pagata.
 */
import { isGiocatore } from './categoria'
import type { Giocatore } from '../types'

export interface StatoQuota {
  /** somma dei versamenti registrati */
  versato: number
  /** importo della quota, se impostato */
  totale?: number
  /** quota saldata */
  completa: boolean
  /** versamenti presenti ma non a saldo */
  parziale: boolean
  /** etichetta breve per tag/elenco, es. "80/150 €" o "Pagata" */
  label: string
}

export function statoQuota(g: Pick<Giocatore, 'quotaPagata' | 'quotaImporto' | 'versamentiQuota'>): StatoQuota {
  const versato = (g.versamentiQuota ?? []).reduce((s, v) => s + (v.importo || 0), 0)
  const totale = g.quotaImporto && g.quotaImporto > 0 ? g.quotaImporto : undefined

  if (totale) {
    const completa = versato >= totale
    return {
      versato,
      totale,
      completa,
      parziale: !completa && versato > 0,
      label: completa ? 'Pagata' : `${versato}/${totale} €`,
    }
  }
  // senza importo impostato vale il vecchio interruttore
  return {
    versato,
    completa: !!g.quotaPagata,
    parziale: false,
    label: g.quotaPagata ? 'Pagata' : 'Da pagare',
  }
}

/** Come vanno le quote di tutta la rosa, per il riepilogo di chi le raccoglie. */
export interface RiepilogoQuote {
  /** quanto è stato raccolto finora (somma di tutti i versamenti) */
  raccolto: number
  /** quanto ci si aspetta di raccogliere (somma degli importi impostati) */
  atteso: number
  /** quanto manca all'appello, per chi ha l'importo impostato */
  mancante: number
  /** quanti hanno saldato */
  saldati: number
  /** quanti devono ancora qualcosa */
  aperte: number
  /** quanti giocatori sono contati qui (i soli dirigenti restano fuori) */
  totali: number
}

/**
 * Somma le quote della rosa. I versamenti NON entrano nei Conti: a fine anno
 * chi le raccoglie registra il totale come unica entrata, e questo riepilogo
 * serve proprio a sapere quale cifra scrivere.
 */
export function riepilogoQuote(
  tesserati: Pick<Giocatore, 'categoria' | 'quotaPagata' | 'quotaImporto' | 'versamentiQuota'>[],
): RiepilogoQuote {
  const rosa = tesserati.filter(isGiocatore)
  let raccolto = 0
  let atteso = 0
  let mancante = 0
  let saldati = 0

  for (const g of rosa) {
    const q = statoQuota(g)
    raccolto += q.versato
    if (q.totale) {
      atteso += q.totale
      mancante += Math.max(0, q.totale - q.versato)
    }
    if (q.completa) saldati++
  }

  return { raccolto, atteso, mancante, saldati, aperte: rosa.length - saldati, totali: rosa.length }
}
