import { useCallback, useLayoutEffect, useReducer, useState, useSyncExternalStore, type SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'

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

const ultimoLink = new Map<string, string>()

/** Applica il filtro del link prima di mostrare la lista, al posto di quelli lasciati aperti. */
export function useFiltriDaLink(prefissi: readonly string[], filtri?: Record<string, unknown>) {
  const { key, pathname } = useLocation()
  const [, aggiorna] = useReducer((versione: number) => versione + 1, 0)

  useLayoutEffect(() => {
    if (!filtri || ultimoLink.get(pathname) === key) return
    ultimoLink.set(pathname, key)
    valori = Object.fromEntries(
      Object.entries(valori).filter(([nome]) => !prefissi.some((prefisso) => nome.startsWith(prefisso))),
    )
    Object.assign(valori, filtri)
    ascoltatori.forEach((f) => f())
    aggiorna()
  }, [filtri, key, pathname, prefissi])
}
