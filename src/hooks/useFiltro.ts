import { useCallback, useState, useSyncExternalStore, type SetStateAction } from 'react'

/**
 * Store dei filtri delle liste: restano impostati cambiando pagina nell'app o
 * aprendo un dettaglio. Solo in memoria: ricaricando la pagina si azzerano.
 */
let valori: Record<string, unknown> = {}
const ascoltatori = new Set<() => void>()

function scrivi(chiave: string, valore: unknown) {
  valori = { ...valori, [chiave]: valore }
  ascoltatori.forEach((f) => f())
}

function iscrivi(f: () => void) {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}

/**
 * Come useState, ma il valore sopravvive allo smontaggio della pagina.
 * La chiave va resa unica per pagina, es. 'rosa.ruolo'.
 */
export function useFiltro<T>(chiave: string, valoreIniziale: T): [T, (v: SetStateAction<T>) => void] {
  // riferimento stabile: con un [] letterale useSyncExternalStore andrebbe in loop
  const [iniziale] = useState(valoreIniziale)
  const valore = useSyncExternalStore(iscrivi, () =>
    chiave in valori ? (valori[chiave] as T) : iniziale,
  )
  const imposta = useCallback(
    (v: SetStateAction<T>) => {
      const prima = chiave in valori ? (valori[chiave] as T) : iniziale
      scrivi(chiave, typeof v === 'function' ? (v as (p: T) => T)(prima) : v)
    },
    [chiave, iniziale],
  )
  return [valore, imposta]
}
