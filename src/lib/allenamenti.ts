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
