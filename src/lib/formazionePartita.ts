/**
 * La formazione di una partita giocata: chi stava in ogni posto del modulo e
 * i cambi. Da qui si ricavano titolari e subentrati (che restano salvati
 * sulla partita per statistiche e presenze).
 */
import type { Cambio, FormazionePartita, Giocatore, Partita } from '../types'
import { MODULI, generaFormazione, type Modulo } from './formazione'

export function moduloDa(id?: string): Modulo {
  return MODULI.find((m) => m.id === id) ?? MODULI[0]
}

/**
 * Formazione di partenza: se la partita ha già dei titolari segnati (da prima
 * che ci fosse il campo) li dispone nei posti del modulo in base al ruolo.
 */
export function formazioneIniziale(p: Partita, modulo: Modulo, rosa: Giocatore[]): FormazionePartita {
  const titolari = (p.titolari ?? [])
    .map((id) => rosa.find((g) => g.id === id))
    .filter((g): g is Giocatore => !!g)
  return { modulo: modulo.id, posti: disponi(modulo, titolari), cambi: [] }
}

/** Mette i giocatori nei posti del modulo per ruolo; chi non trova posto va nei buchi rimasti. */
export function disponi(modulo: Modulo, giocatori: Giocatore[]): (string | null)[] {
  const gen = generaFormazione(modulo, giocatori, {})
  const posti = gen.titolari.map((a) => a?.giocatoreId ?? null)
  const avanzati = [...gen.panchina]
  return posti.map((id) => id ?? avanzati.shift() ?? null)
}

/** Cambio modulo: stessi giocatori, ridisposti sui posti nuovi. */
export function cambiaModulo(f: FormazionePartita, modulo: Modulo, rosa: Giocatore[]): FormazionePartita {
  const giocatori = f.posti
    .filter((id): id is string => !!id)
    .map((id) => rosa.find((g) => g.id === id))
    .filter((g): g is Giocatore => !!g)
  return { ...f, modulo: modulo.id, posti: disponi(modulo, giocatori) }
}

/** I cambi in ordine di minuto (quelli senza minuto in fondo, nell'ordine in cui sono stati segnati). */
export function cambiOrdinati(cambi: Cambio[]): Cambio[] {
  return cambi
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.minuto ?? 999) - (b.c.minuto ?? 999) || a.i - b.i)
    .map((x) => x.c)
}

/** Chi è passato da un posto: il titolare e poi, cambio dopo cambio, chi l'ha rilevato. */
export function catenaPosto(titolare: string, cambi: Cambio[]): { id: string; minuto?: number }[] {
  const out: { id: string; minuto?: number }[] = [{ id: titolare }]
  const usati = new Set<Cambio>()
  let attuale = titolare
  for (;;) {
    const c = cambiOrdinati(cambi).find((x) => x.esce === attuale && !usati.has(x))
    if (!c) return out
    usati.add(c)
    out.push({ id: c.entra, minuto: c.minuto })
    attuale = c.entra
  }
}

/** Chi è in campo alla fine (quindi può ancora uscire). */
export function inCampo(f: FormazionePartita): string[] {
  const dentro = new Set(f.posti.filter((id): id is string => !!id))
  for (const c of cambiOrdinati(f.cambi)) {
    dentro.delete(c.esce)
    dentro.add(c.entra)
  }
  return [...dentro]
}

/**
 * Titolari e subentrati da salvare sulla partita insieme alla formazione.
 * I subentrati già segnati senza un cambio (dati di prima) restano.
 */
export function sincronizza(prima: Partita, f: FormazionePartita): Pick<Partita, 'formazione' | 'titolari' | 'subentrati'> {
  const titolari = f.posti.filter((id): id is string => !!id)
  const entratiPrima = new Set(prima.formazione?.cambi.map((c) => c.entra) ?? [])
  const liberi = (prima.subentrati ?? []).filter((id) => !entratiPrima.has(id) && !titolari.includes(id))
  const subentrati = [...new Set([...f.cambi.map((c) => c.entra), ...liberi])].filter(
    (id) => !titolari.includes(id),
  )
  return { formazione: f, titolari, subentrati }
}

/** Subentrati segnati a mano, senza sapere per chi sono entrati. */
export function subentratiSenzaCambio(p: Partita): string[] {
  const f = p.formazione
  if (!f) return p.subentrati ?? []
  const entrati = new Set(f.cambi.map((c) => c.entra))
  return (p.subentrati ?? []).filter((id) => !entrati.has(id) && !f.posti.includes(id))
}

/** Gli eventi di un giocatore nella partita, per le icone sul campo. */
export interface EventiGiocatore {
  gol: number
  assist: number
  giallo: boolean
  rosso: boolean
}

export function eventiDi(p: Partita, id: string): EventiGiocatore {
  return {
    gol: p.marcatori?.find((m) => m.giocatoreId === id)?.quantita ?? 0,
    assist: p.assist?.find((m) => m.giocatoreId === id)?.quantita ?? 0,
    giallo: (p.ammoniti ?? []).includes(id),
    rosso: (p.espulsi ?? []).includes(id),
  }
}
