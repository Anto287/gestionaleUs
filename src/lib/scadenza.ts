/** Stato di una data di scadenza (magazzino, ecc.). */

export interface StatoScadenza {
  /** etichetta breve per il tag; vuota se nessun tag serve */
  label: string
  /** colore antd del tag, se presente */
  color?: string
  /** true se scaduto o in scadenza entro un mese (riga rossa lampeggiante) */
  critico: boolean
  /** giorni mancanti alla scadenza: negativo se già scaduto, null se senza data */
  giorni: number | null
}

/** Soglia (giorni) entro cui un articolo va segnalato: circa un mese. */
export const GIORNI_ALLARME = 30

/** Giorni mancanti alla scadenza: negativo se già scaduto, null se senza data. */
export function giorniAllaScadenza(scadenza?: string): number | null {
  if (!scadenza) return null
  return Math.round((new Date(scadenza + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
}

export function statoScadenza(scadenza?: string): StatoScadenza {
  const giorni = giorniAllaScadenza(scadenza)
  if (giorni === null) return { label: '', critico: false, giorni: null }

  if (giorni < 0) return { label: 'Scaduto', color: 'red', critico: true, giorni }
  if (giorni === 0) return { label: 'Scade oggi', color: 'red', critico: true, giorni }
  if (giorni <= GIORNI_ALLARME)
    return { label: `Tra ${giorni} gg`, color: 'red', critico: true, giorni }
  return { label: '', critico: false, giorni }
}
