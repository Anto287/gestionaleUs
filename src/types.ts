/**
 * Modelli dei dati del gestionale.
 * Ogni raccolta diventerà un foglio/file sul Drive quando sarà collegato.
 */

/** Categoria del tesserato: chi manca del campo (dati esistenti) è giocatore.
 *  'extra' = giocatore una tantum: utile tenerlo in lista, ma non c'è sempre. */
export type Categoria = 'giocatore' | 'dirigente' | 'entrambi' | 'extra'

/**
 * Un giocatore della rosa. Presenze (dagli allenamenti) e statistiche
 * (gol, assist, ammonizioni, espulsioni — dalle partite) si calcolano
 * automaticamente, non si salvano sul giocatore.
 */
export interface Giocatore {
  id: string
  nome: string
  cognome: string
  categoria?: Categoria
  /** incarico in dirigenza, testo libero (es. "Presidente"); solo per dirigenti */
  ruoloDirigenza?: string
  /** codice ruolo stile FIFA (vedi src/ruoli.ts), es. 'DC', 'COC' */
  ruoloPreferito?: string
  /** ruoli in cui è adattabile */
  ruoliAdattati?: string[]
  /** bravura/qualità su scala 1–5 (facoltativa); usata dal generatore di formazione */
  bravura?: number
  /** numero di maglia abituale; precompila distinta e grafica formazione */
  numeroMaglia?: number
  /** dati per la distinta */
  nascita?: string
  tessera?: string
  dataRilascio?: string
  /** certificato medico (non riguarda chi è solo dirigente) */
  certificatoMedico?: boolean
  scadenzaCertificato?: string
  /** quota associativa pagata: riparte da false a ogni nuova stagione (non riguarda chi è solo dirigente) */
  quotaPagata?: boolean
  /** importo della quota stagionale in euro; se impostato, lo stato quota deriva dai versamenti */
  quotaImporto?: number
  /** versamenti della quota (acconti/saldo); ognuno può avere il movimento gemello nei Conti */
  versamentiQuota?: VersamentoQuota[]
  /** attualmente infortunato: escluso dal generatore di formazione */
  infortunato?: boolean
  /** data prevista di rientro dall'infortunio (informativa) */
  rientroInfortunio?: string
  /** annotazioni libere (taglia maglia, recapiti, ecc.) */
  note?: string
}

/** Un versamento della quota associativa. */
export interface VersamentoQuota {
  id: string
  data: string
  importo: number
  note?: string
  /** id del movimento creato nei Conti, per rimuoverlo insieme */
  movimentoId?: string
}

/** Una cosa da fare inserita a mano nel pannello della dashboard. */
export interface Promemoria {
  id: string
  /** cosa c'è da fare, es. "chiudere le buche delle talpe" */
  testo: string
  /** entro quando ('YYYY-MM-DD', facoltativa) */
  entro?: string
  urgente?: boolean
  /** chi se ne sta occupando (facoltativo) */
  assegnatoA?: string
  fatto?: boolean
  /** data di inserimento ('YYYY-MM-DD') */
  creato?: string
}

/** Una partita in programma inserita a mano (calendario e grafiche del mese). */
export interface Appuntamento {
  id: string
  /** data in formato ISO 'YYYY-MM-DD' */
  data: string
  /** orario di inizio, es. "15:30" */
  ora?: string
  avversario: string
  inCasa: boolean
  /** campo/luogo (facoltativo), es. "Comunale di Riolunato" */
  luogo?: string
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
  /** orario di inizio, es. "15:30" (facoltativo; usato per calendario e annunci) */
  ora?: string
  avversario: string
  inCasa: boolean
  /** id del torneo/competizione (vedi Torneo); assente = non assegnata */
  torneoId?: string
  /**
   * true = già giocata (ha un risultato); false = in programma (nessun
   * risultato ancora). Assente vale già giocata, per i dati precedenti.
   */
  giocata?: boolean
  golFatti: number
  golSubiti: number
  marcatori: EventoGol[]
  assist: EventoGol[]
  /** id giocatori ammoniti (un giallo a testa) */
  ammoniti: string[]
  /** id giocatori espulsi */
  espulsi: string[]
  /** id giocatori scesi in campo dal 1' (per le presenze partita) */
  titolari?: string[]
  /** id giocatori subentrati dalla panchina */
  subentrati?: string[]
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

/** Una riga di dati tesserato usata dentro la distinta (Nome, Cognome, ecc.). */
export type RigaConvocato = Record<string, unknown>

/**
 * Un convocato nella distinta: il numero di maglia (amount), gli eventuali
 * ruoli (C/VC/Allen/…) e i dati del tesserato in `raw`.
 */
export interface Convocato {
  id: string
  label: string
  raw: RigaConvocato
  amount: number | null
  [k: string]: unknown
}

/**
 * Una distinta salvata. Si può riprenderla dall'elenco, ricompilarne i campi,
 * modificarli e ristamparla. La testata e i convocati sono l'istantanea usata
 * per il PDF; `data` e `avversario` sono copiati dalla testata per l'elenco.
 */
export interface Distinta {
  id: string
  /** quando è stata salvata l'ultima volta (ISO con ora) */
  creata: string
  /** data della gara (ISO 'YYYY-MM-DD'), copia dalla testata */
  data?: string
  /** avversario, copia dalla testata */
  avversario?: string
  testata: TestataDistinta
  convocati: Convocato[]
}

/**
 * Una tuta/divisa da gara, definita nel Magazzino. I colori finiscono
 * nella testata della distinta quando la si sceglie.
 */
export interface Divisa {
  id: string
  nome: string
  coloreMaglia?: string
  colorePantaloncini?: string
  coloreCalzettoni?: string
}

/**
 * Un torneo/competizione col suo girone (es. Campionato, Coppa), definito
 * nelle Impostazioni. Nella distinta si sceglie da un elenco a tendina.
 */
export interface Torneo {
  id: string
  nome: string
  girone?: string
}

/**
 * I valori di testata da stampare in cima alla distinta. Tutti facoltativi:
 * se restano vuoti, la distinta si stampa con le righe da compilare a mano.
 */
export interface TestataDistinta {
  coloreMaglia?: string
  colorePantaloncini?: string
  coloreCalzettoni?: string
  torneo?: string
  girone?: string
  /** data della gara in formato ISO 'YYYY-MM-DD' */
  dataGara?: string
  /** orario di inizio gara, es. "15:30" */
  oraGara?: string
  /** orario di ritrovo/presentazione o note libere */
  orarioRitrovo?: string
  /** squadra avversaria */
  avversario?: string
  /** campo di gioco */
  campo?: string
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

/**
 * Una voce di un magazzino generico (bar, materiale allenamento, manutenzione
 * campo, borsa medica). Ogni sezione usa solo i campi che le servono; per
 * questo, oltre al nome, sono tutti facoltativi. `Articolo` ne è un caso.
 */
export interface VoceMagazzino {
  id: string
  nome: string
  categoria?: string
  quantita?: number
  /** sotto questa quantità l'articolo va riordinato (facoltativa) */
  scortaMinima?: number
  /** data di scadenza (per il bar e la borsa medica) */
  scadenza?: string
  note?: string
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
  /** categoria di spesa/incasso (es. Quote, Bar, Arbitri…), testo libero */
  categoria?: string
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
