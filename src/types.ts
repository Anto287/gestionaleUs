/**
 * Modelli dei dati del gestionale.
 * Ogni raccolta diventerà un foglio/file sul Drive quando sarà collegato.
 */

/**
 * Un giocatore della rosa. Presenze (dagli allenamenti) e statistiche
 * (gol, assist, ammonizioni, espulsioni — dalle partite) si calcolano
 * automaticamente, non si salvano sul giocatore.
 */
export interface Giocatore {
  id: string
  nome: string
  cognome: string
  /** codice ruolo stile FIFA (vedi src/ruoli.ts), es. 'DC', 'COC' */
  ruoloPreferito?: string
  /** ruoli in cui è adattabile */
  ruoliAdattati?: string[]
  /** dati per la distinta */
  nascita?: string
  tessera?: string
  dataRilascio?: string
  /** certificato medico */
  certificatoMedico?: boolean
  scadenzaCertificato?: string
}

/** Gol o assist attribuiti a un giocatore in una partita. */
export interface EventoGol {
  giocatoreId: string
  quantita: number
}

/** Il risultato e gli eventi di una partita. Da qui derivano le statistiche. */
export interface Partita {
  id: string
  data: string
  avversario: string
  inCasa: boolean
  golFatti: number
  golSubiti: number
  marcatori: EventoGol[]
  assist: EventoGol[]
  /** id giocatori ammoniti (un giallo a testa) */
  ammoniti: string[]
  /** id giocatori espulsi */
  espulsi: string[]
  note?: string
}

/** Una seduta di allenamento, con le presenze dei giocatori. */
export interface Allenamento {
  id: string
  data: string
  note?: string
  /** id giocatore → presente */
  presenze: Record<string, boolean>
}

/** La distinta di una partita. */
export interface Distinta {
  id: string
  data: string
  avversario: string
  inCasa: boolean
  modulo?: string
  /** id giocatori titolari (max 11) */
  titolari: string[]
  /** id giocatori in panchina */
  panchina: string[]
  note?: string
}

/** Un articolo del magazzino del bar. Possono esserci più articoli con lo stesso nome. */
export interface Articolo {
  id: string
  nome: string
  categoria: string
  quantita: number
  /** data di scadenza (facoltativa); si ordina per questa */
  scadenza?: string
}

/** Un movimento di cassa: entrata o uscita, saldato o ancora aperto. */
export interface Movimento {
  id: string
  data: string
  descrizione: string
  tipo: 'entrata' | 'uscita'
  importo: number
  /** false = ancora da incassare (entrata) o da pagare (uscita) */
  saldato: boolean
  controparte?: string
}

/** Un documento della società. Il file vero vive nella cartella Documenti sul Drive. */
export interface Documento {
  id: string
  nome: string
  tipo: string
  dimensione: number
  caricatoIl: string
  /** link al file sul Drive (modalità Drive) */
  url?: string
  /** contenuto del file per download locale (modalità senza Drive) */
  dataUrl?: string
}
