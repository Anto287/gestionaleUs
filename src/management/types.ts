export interface Device {
  id: string
  nome: string
  browser: string
  sistema: string
  primoAccesso: string
  ultimoAccesso: string
}

export interface Activity {
  id: string
  deviceId: string
  data: string
  azione: string
  sezione: string
  stagione: string
  elemento: string
  esito: 'riuscita' | 'fallita' | 'in_corso'
  dettagli: { campo: string; prima: string; dopo: string }[]
  tentativi?: number
  errore?: string
}

export interface ActivityFilters {
  deviceId?: string
  dal?: string
  al?: string
  ricerca?: string
  esito?: string
  sezione?: string
  stagione?: string
  offset?: number
}
