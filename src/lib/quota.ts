/**
 * Stato della quota associativa di un giocatore. Se è impostato l'importo
 * della quota (quotaImporto), lo stato deriva dalla somma dei versamenti;
 * altrimenti vale il vecchio interruttore pagata/non pagata. Chi è esente
 * non deve niente: conta come a posto, ma non come "saldato".
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
  /** esente dalla quota: niente da pagare */
  esente: boolean
  /** etichetta breve per tag/elenco, es. "80/150 €", "Pagata" o "Esente" */
  label: string
}

export function statoQuota(
  g: Pick<Giocatore, 'quotaPagata' | 'quotaImporto' | 'versamentiQuota' | 'quotaEsente'>,
): StatoQuota {
  const versato = (g.versamentiQuota ?? []).reduce((s, v) => s + (v.importo || 0), 0)
  if (g.quotaEsente) return { versato, completa: true, parziale: false, esente: true, label: 'Esente' }
  const totale = g.quotaImporto && g.quotaImporto > 0 ? g.quotaImporto : undefined

  if (totale) {
    const completa = versato >= totale
    return {
      versato,
      totale,
      completa,
      parziale: !completa && versato > 0,
      esente: false,
      label: completa ? 'Pagata' : `${versato}/${totale} €`,
    }
  }
  // senza importo impostato vale il vecchio interruttore
  return {
    versato,
    completa: !!g.quotaPagata,
    parziale: false,
    esente: false,
    label: g.quotaPagata ? 'Pagata' : 'Da pagare',
  }
}

/** Come vanno le quote di tutta la rosa, per il riepilogo di chi le raccoglie. */
export interface RiepilogoQuote {
  /** quanto è stato raccolto finora (versamenti di tutti, esclusi quelli già nei Conti) */
  raccolto: number
  /** quanto ci si aspetta di raccogliere (somma degli importi impostati) */
  atteso: number
  /** quanto manca all'appello, per chi ha l'importo impostato */
  mancante: number
  /** quanti hanno saldato (gli esenti no: stanno in esenti) */
  saldati: number
  /** quanti sono esenti dalla quota */
  esenti: number
  /** quanti devono ancora qualcosa */
  aperte: number
  /** quanti giocatori devono una quota (fuori i soli dirigenti e gli esenti) */
  totali: number
  /** saldati col solo interruttore, senza importo: non entrano nel raccolto */
  soloInterruttore: number
  /** versamenti vecchi col movimento gemello: sono già nei Conti, fuori dal raccolto */
  giaNeiConti: number
}

/**
 * Somma le quote della rosa. I versamenti NON entrano nei Conti: a fine anno
 * chi le raccoglie registra il totale come unica entrata, e questo riepilogo
 * serve proprio a sapere quale cifra scrivere.
 */
export function riepilogoQuote(
  tesserati: Pick<Giocatore, 'categoria' | 'quotaPagata' | 'quotaImporto' | 'versamentiQuota' | 'quotaEsente'>[],
): RiepilogoQuote {
  const giocatori = tesserati.filter(isGiocatore)
  const esenti = giocatori.filter((g) => g.quotaEsente).length
  // chi è esente non deve niente: fuori da atteso, saldati e aperte
  const rosa = giocatori.filter((g) => !g.quotaEsente)
  let raccolto = 0
  let giaNeiConti = 0
  let atteso = 0
  let mancante = 0
  let saldati = 0
  let soloInterruttore = 0

  // il raccolto conta i versamenti di TUTTI (anche di chi poi è diventato
  // dirigente); quelli vecchi col movimento sono già nei Conti e restano a parte
  for (const g of tesserati) {
    for (const v of g.versamentiQuota ?? []) {
      if (v.movimentoId) giaNeiConti += v.importo || 0
      else raccolto += v.importo || 0
    }
  }

  for (const g of rosa) {
    const q = statoQuota(g)
    if (q.totale) {
      atteso += q.totale
      mancante += Math.max(0, q.totale - q.versato)
    }
    if (q.completa) saldati++
    if (q.completa && !q.totale) soloInterruttore++
  }

  return { raccolto, atteso, mancante, saldati, esenti, aperte: rosa.length - saldati, totali: rosa.length, soloInterruttore, giaNeiConti }
}
