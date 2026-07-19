/**
 * Appuntamenti (partite in programma) inseriti a mano: usati dal calendario e
 * dalla grafica IG del mese. Dal 2026-07 sono una raccolta sul Drive
 * ('appuntamenti', foglio creato al primo salvataggio), non più mono-uso.
 */
import { useCollection } from '../hooks/useCollection'
import type { Appuntamento } from '../types'

export type { Appuntamento }

export function useAppuntamenti() {
  const { items, add, remove } = useCollection<Appuntamento>('appuntamenti')

  const aggiungi = (a: Omit<Appuntamento, 'id'>): string => add(a)
  const rimuovi = (id: string) => remove(id)

  return { list: items, aggiungi, rimuovi }
}
