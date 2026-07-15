/**
 * Appuntamenti (partite in programma) inseriti a mano nella pagina "Grafiche IG".
 * Sono mono-uso: vivono solo finché si resta sulla pagina, non vengono salvati.
 */
import { useState } from 'react'

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

export function useAppuntamenti() {
  const [list, setList] = useState<Appuntamento[]>([])

  const aggiungi = (a: Omit<Appuntamento, 'id'>): string => {
    const item: Appuntamento = { ...a, id: crypto.randomUUID() }
    setList((l) => [...l, item])
    return item.id
  }
  const rimuovi = (id: string) => setList((l) => l.filter((x) => x.id !== id))

  return { list, aggiungi, rimuovi }
}
