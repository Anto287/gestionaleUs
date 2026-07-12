/** Stato di una data di scadenza (magazzino, ecc.). */

export interface StatoScadenza {
  /** etichetta breve per il tag; vuota se nessun tag serve */
  label: string
  /** colore antd del tag, se presente */
  color?: string
  /** true se scaduto o in scadenza a breve */
  critico: boolean
}

/** Soglia (giorni) entro cui un articolo è considerato "in scadenza". */
const GIORNI_AVVISO = 14

export function statoScadenza(scadenza?: string): StatoScadenza {
  if (!scadenza) return { label: '', critico: false }

  const oggi = new Date().toISOString().slice(0, 10)
  if (scadenza < oggi) return { label: 'Scaduto', color: 'red', critico: true }

  const giorni = Math.round(
    (new Date(scadenza + 'T00:00:00').getTime() - Date.now()) / 86_400_000,
  )
  if (giorni <= GIORNI_AVVISO) return { label: `Tra ${giorni} gg`, color: 'orange', critico: true }
  return { label: '', critico: false }
}
