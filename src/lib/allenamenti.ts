import { oggiIso } from './format'
import type { Allenamento } from '../types'

/**
 * Le sedute già svolte (fino a oggi compreso). Dal calendario si possono
 * creare allenamenti in anticipo: quelli futuri non hanno ancora presenze e
 * non devono abbassare percentuali, medie e classifiche.
 */
export function seduteSvolte<T extends Pick<Allenamento, 'data'>>(sedute: T[]): T[] {
  const oggi = oggiIso()
  return sedute.filter((s) => s.data <= oggi)
}

/** Una presenza può trovarsi in uno dei due registri dopo un cambio di categoria. */
export function presenteAllenamento(seduta: Allenamento, id: string): boolean {
  return !!(seduta.presenze[id] || seduta.presenzeOspiti?.[id])
}

export function idPresentiAllenamento(seduta: Allenamento): Set<string> {
  return new Set([
    ...Object.keys(seduta.presenze).filter((id) => seduta.presenze[id]),
    ...Object.keys(seduta.presenzeOspiti ?? {}),
  ])
}
