/** Stato del certificato medico di un giocatore. */
import { oggiIso } from './format'
import { giorniAllaScadenza } from './scadenza'

export interface StatoCertificato {
  label: string
  /** colore antd (Tag/Badge) */
  color: string
  /** true se manca o è scaduto (situazione da risolvere) */
  critico: boolean
  /** categoria sintetica, usata dai filtri della rosa */
  stato: 'valido' | 'scadenza' | 'critico'
}

export function statoCertificato(g: {
  certificatoMedico?: boolean
  scadenzaCertificato?: string
}): StatoCertificato {
  if (!g.certificatoMedico) return { label: 'Mancante', color: 'red', critico: true, stato: 'critico' }
  if (!g.scadenzaCertificato) return { label: 'Consegnato', color: 'green', critico: false, stato: 'valido' }

  if (g.scadenzaCertificato < oggiIso())
    return { label: 'Scaduto', color: 'red', critico: true, stato: 'critico' }

  const giorni = giorniAllaScadenza(g.scadenzaCertificato) ?? 0
  if (giorni <= 30) {
    const quando = giorni === 0 ? 'Scade oggi' : giorni === 1 ? 'Scade domani' : `In scadenza (${giorni} gg)`
    return { label: quando, color: 'orange', critico: false, stato: 'scadenza' }
  }
  return { label: 'Valido', color: 'green', critico: false, stato: 'valido' }
}
