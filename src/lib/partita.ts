import type { EventoGol, Partita } from '../types'

/** In campo dal 1' vanno al massimo 11 giocatori. */
export const MAX_TITOLARI = 11

/** Formato accettato per l'ora della partita, es. "15:30". */
export const REGEX_ORA = /^([01]?\d|2[0-3]):[0-5]\d$/

/** Somma dei gol (o assist) attribuiti nei singoli eventi. */
export function sommaEventi(eventi?: EventoGol[]): number {
  return (eventi ?? []).reduce((tot, e) => tot + e.quantita, 0)
}

/**
 * Controlli di coerenza su una partita. La UI impedisce di inserire dati
 * incoerenti nuovi; qui si segnalano quelli già presenti (dati vecchi), così
 * si possono sistemare. `nome` traduce l'id giocatore nel nome da mostrare.
 */
export function problemiPartita(p: Partita, nome: (id: string) => string): string[] {
  const out: string[] = []
  const giocata = p.giocata !== false
  const golMarcatori = sommaEventi(p.marcatori)
  const golAssist = sommaEventi(p.assist)
  const titolari = p.titolari ?? []
  const subentrati = p.subentrati ?? []

  if (giocata && golMarcatori > p.golFatti)
    out.push(`I marcatori sommano ${golMarcatori} gol, ma la squadra ne ha fatti ${p.golFatti}.`)
  if (giocata && golAssist > p.golFatti)
    out.push(`Gli assist sommano ${golAssist}, ma i gol fatti sono ${p.golFatti}.`)
  if (
    !giocata &&
    (golMarcatori || golAssist || (p.ammoniti ?? []).length || (p.espulsi ?? []).length)
  )
    out.push('La partita è in programma ma ha già eventi segnati: imposta il risultato o toglili.')

  if (titolari.length > MAX_TITOLARI)
    out.push(`Ci sono ${titolari.length} titolari: in campo dal 1' vanno al massimo ${MAX_TITOLARI}.`)
  for (const id of subentrati) {
    if (titolari.includes(id)) out.push(`${nome(id)} è segnato sia titolare che subentrato.`)
  }

  // se la formazione è tracciata, chi ha eventi deve risultare in campo
  const inCampo = new Set([...titolari, ...subentrati])
  if (inCampo.size > 0) {
    const controlla = (ids: string[], cosa: string) => {
      for (const id of ids)
        if (!inCampo.has(id)) out.push(`${nome(id)} è tra ${cosa} ma non risulta in campo.`)
    }
    controlla((p.marcatori ?? []).map((m) => m.giocatoreId), 'i marcatori')
    controlla((p.assist ?? []).map((m) => m.giocatoreId), 'gli assist')
    controlla(p.ammoniti ?? [], 'gli ammoniti')
    controlla(p.espulsi ?? [], 'gli espulsi')
  }
  return out
}
