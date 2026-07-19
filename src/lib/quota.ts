/**
 * Stato della quota associativa di un giocatore. Se è impostato l'importo
 * della quota (quotaImporto), lo stato deriva dalla somma dei versamenti;
 * altrimenti vale il vecchio interruttore pagata/non pagata.
 */
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
