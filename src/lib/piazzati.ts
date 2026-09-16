/**
 * Calci piazzati: chi batte e chi va dove sulle palle ferme.
 *
 * Qui c'è solo il catalogo degli incarichi, diviso in tre blocchi (chi batte,
 * cosa si fa quando battiamo noi, cosa si fa quando battono loro). La scheda
 * salvata tiene, per ogni incarico, gli id dei giocatori in ordine.
 *
 * Due tipi di caselle: dove si sceglie chi tocca (battitori) l'ordine è la
 * scelta — 1ª scelta, 2ª scelta; dove invece sono uomini messi in campo
 * (barriera, centro area, chi resta dietro) l'ordine è la posizione, 1º, 2º…
 * e l'incarico è segnato `posizionale`.
 *
 * Il catalogo segue il foglio corretto a mano dal mister (2026-09-16): le
 * righe e il numero di caselle sono quelle, non vanno cambiate a occhio.
 */

export interface Incarico {
  key: string
  label: string
  /** riga piccola sotto il nome dell'incarico */
  nota?: string
  /** quante caselle si possono riempire */
  slot: number
  /** true = le caselle sono posizioni (barriera, posti in area), non ordine di scelta */
  posizionale?: boolean
  /** etichette su misura, casella per casella (es. il 5º della barriera che va in giro) */
  etichette?: string[]
}

export interface Reparto {
  key: string
  titolo: string
  nota: string
  incarichi: Incarico[]
}

export const REPARTI: Reparto[] = [
  {
    key: 'battitori',
    titolo: 'Chi batte',
    nota: 'Prima e seconda scelta: se il primo è in panchina o fuori, si sa già chi tocca.',
    incarichi: [
      { key: 'angoloDx', label: "Calci d'angolo · destra", slot: 2 },
      { key: 'angoloSx', label: "Calci d'angolo · sinistra", slot: 2 },
      { key: 'punizioneVicino', label: 'Punizioni da vicino', nota: 'tiro in porta', slot: 1 },
      { key: 'punizioneLontano', label: 'Punizioni da lontano', nota: 'palla in mezzo', slot: 1 },
      { key: 'rigori', label: 'Rigori', slot: 2 },
    ],
  },
  {
    key: 'favore',
    titolo: 'Palla ferma a favore',
    nota: "Dove si va quando l'angolo o la punizione la battiamo noi.",
    incarichi: [
      { key: 'primoPaloAtt', label: 'Attacca il primo palo', slot: 1 },
      { key: 'secondoPaloAtt', label: 'Attacca il secondo palo', slot: 1 },
      { key: 'dischetto', label: 'Centro area', nota: 'sul dischetto', slot: 6, posizionale: true },
      { key: 'limiteAtt', label: 'Sul limite', nota: 'raccoglie le respinte', slot: 1 },
      { key: 'coperturaAtt', label: 'Resta dietro', nota: 'copre la ripartenza', slot: 2, posizionale: true },
    ],
  },
  {
    key: 'contro',
    titolo: 'Palla ferma contro',
    nota: 'La barriera e i posti in area quando battono loro.',
    incarichi: [
      {
        key: 'barriera',
        label: 'Barriera frontale',
        nota: 'dal primo all’ultimo',
        slot: 5,
        posizionale: true,
        etichette: ['1º', '2º', '3º', '4º', '5º (in giro)'],
      },
      { key: 'barrieraLatDx', label: 'Barriera laterale · destra', slot: 2, posizionale: true },
      { key: 'barrieraLatSx', label: 'Barriera laterale · sinistra', slot: 2, posizionale: true },
      { key: 'giroLaterale', label: 'Giro', nota: 'sulle laterali: chi parte sulla palla', slot: 1 },
      { key: 'primoPaloDif', label: 'Primo palo', nota: 'sugli angoli', slot: 1 },
      { key: 'angoloCorto', label: 'Angolo corto', nota: 'esce se battono corto', slot: 1 },
      { key: 'palla2Palo', label: 'Cercare palla dal 2º palo', slot: 1 },
      { key: 'limiteDif', label: "Sul limite dell'area", nota: 'respinte e seconde palle', slot: 1 },
      { key: 'restaSu', label: 'Resta avanti', nota: 'punto di riferimento in ripartenza', slot: 1 },
    ],
  },
]

export const TUTTI_INCARICHI: Incarico[] = REPARTI.flatMap((r) => r.incarichi)

/** Quante caselle in tutto (per la percentuale di compilazione). */
export const CASELLE_TOTALI = TUTTI_INCARICHI.reduce((n, i) => n + i.slot, 0)

/** Quante caselle sono state riempite. */
export function caselleAssegnate(incarichi: Record<string, string[]>): number {
  return TUTTI_INCARICHI.reduce(
    (n, i) => n + (incarichi[i.key] ?? []).slice(0, i.slot).filter(Boolean).length,
    0,
  )
}

/** L'etichetta di una casella: "1ª scelta", "2º" fra i posti, niente se è unica. */
export function etichettaCasella(inc: Incarico, i: number): string {
  const suMisura = inc.etichette?.[i]
  if (suMisura) return suMisura
  if (inc.posizionale) return `${i + 1}º`
  if (inc.slot === 1) return ''
  return `${i + 1}ª scelta`
}

/** Gli incarichi in cui compare un giocatore (per la sua scheda). */
export function incarichiDi(incarichi: Record<string, string[]>, giocatoreId: string): Incarico[] {
  return TUTTI_INCARICHI.filter((i) => (incarichi[i.key] ?? []).includes(giocatoreId))
}
