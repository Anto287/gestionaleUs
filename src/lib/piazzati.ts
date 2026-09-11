/**
 * Calci piazzati: chi batte e chi va dove sulle palle ferme.
 *
 * Qui c'è solo il catalogo degli incarichi, diviso in tre blocchi (chi batte,
 * cosa si fa quando battiamo noi, cosa si fa quando battono loro). La scheda
 * salvata tiene, per ogni incarico, gli id dei giocatori in ordine: nella
 * barriera l'ordine è la posizione (1º, 2º…), altrove è la scelta (prima
 * scelta, seconda…).
 */

export interface Incarico {
  key: string
  label: string
  /** riga piccola sotto il nome dell'incarico */
  nota?: string
  /** quante caselle si possono riempire */
  slot: number
  /** true = le caselle sono posizioni (barriera), non ordine di scelta */
  posizionale?: boolean
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
      { key: 'punizioneVicino', label: 'Punizioni da vicino', nota: 'tiro in porta', slot: 2 },
      { key: 'punizioneLontano', label: 'Punizioni da lontano', nota: 'palla in mezzo', slot: 2 },
      { key: 'rigori', label: 'Rigori', slot: 3 },
      { key: 'rimesse', label: 'Falli laterali', nota: 'rimesse lunghe', slot: 3 },
    ],
  },
  {
    key: 'favore',
    titolo: 'Palla ferma a favore',
    nota: "Dove si va quando l'angolo o la punizione la battiamo noi.",
    incarichi: [
      { key: 'primoPaloAtt', label: 'Attacca il primo palo', slot: 2 },
      { key: 'secondoPaloAtt', label: 'Attacca il secondo palo', slot: 2 },
      { key: 'dischetto', label: 'Centro area', nota: 'sul dischetto', slot: 2 },
      { key: 'limiteAtt', label: 'Sul limite', nota: 'raccoglie le respinte', slot: 2 },
      { key: 'cortoAtt', label: 'Schema corto', nota: 'si smarca vicino alla bandierina', slot: 2 },
      { key: 'coperturaAtt', label: 'Resta dietro', nota: 'copre la ripartenza', slot: 2 },
    ],
  },
  {
    key: 'contro',
    titolo: 'Palla ferma contro',
    nota: 'La barriera e i posti in area quando battono loro.',
    incarichi: [
      { key: 'barriera', label: 'Barriera', nota: 'dal primo all’ultimo', slot: 5, posizionale: true },
      { key: 'primoPaloDif', label: 'Primo palo', slot: 1 },
      { key: 'secondoPaloDif', label: 'Secondo palo', slot: 1 },
      { key: 'cortoDif', label: 'Esce sul corto', nota: 'accorcia sulla bandierina', slot: 1 },
      { key: 'limiteDif', label: "Sul limite dell'area", nota: 'respinte e seconde palle', slot: 2 },
      { key: 'restaSu', label: 'Resta avanti', nota: 'punto di riferimento in ripartenza', slot: 2 },
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

/** L'etichetta di una casella: "1ª scelta", "2º" nella barriera, niente se è unica. */
export function etichettaCasella(inc: Incarico, i: number): string {
  if (inc.posizionale) return `${i + 1}º`
  if (inc.slot === 1) return ''
  return `${i + 1}ª scelta`
}

/** Gli incarichi in cui compare un giocatore (per la sua scheda). */
export function incarichiDi(incarichi: Record<string, string[]>, giocatoreId: string): Incarico[] {
  return TUTTI_INCARICHI.filter((i) => (incarichi[i.key] ?? []).includes(giocatoreId))
}
