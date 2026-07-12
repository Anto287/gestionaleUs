import { useData } from '../data/DataProvider'

export interface Collection<T> {
  items: T[]
  add: (item: Omit<T, 'id'>) => string
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  replace: (next: T[]) => void
}

/**
 * Accesso a una raccolta della stagione attiva. I dati arrivano dal
 * DataProvider (Drive del Riolunato, o browser se il Drive non è
 * configurato). Le pagine non sanno da dove vengono: usano solo questo hook.
 */
export function useCollection<T extends { id: string }>(nome: string): Collection<T> {
  const data = useData()
  return {
    items: data.getItems<T>(nome),
    add: (item) => data.add<T>(nome, item),
    update: (id, patch) => data.update<T>(nome, id, patch),
    remove: (id) => data.remove(nome, id),
    replace: () => {
      // non usato con l'archiviazione su Drive
    },
  }
}
