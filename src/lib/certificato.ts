/** Stato del certificato medico di un giocatore. */

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

  const oggi = new Date().toISOString().slice(0, 10)
  if (g.scadenzaCertificato < oggi) return { label: 'Scaduto', color: 'red', critico: true, stato: 'critico' }

  const giorni = Math.round(
    (new Date(g.scadenzaCertificato + 'T00:00:00').getTime() - Date.now()) / 86_400_000,
  )
  if (giorni <= 30)
    return { label: `In scadenza (${giorni} gg)`, color: 'orange', critico: false, stato: 'scadenza' }
  return { label: 'Valido', color: 'green', critico: false, stato: 'valido' }
}
