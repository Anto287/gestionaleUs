/** Filtro "periodo" per i grafici: di default tutto, oppure una finestra recente. */
export type PeriodoChart = 'tutto' | 'anno' | '6m' | '3m'

export const OPZIONI_PERIODO = [
  { value: 'tutto', label: 'Tutto il periodo' },
  { value: 'anno', label: 'Ultimo anno' },
  { value: '6m', label: 'Ultimi 6 mesi' },
  { value: '3m', label: 'Ultimi 3 mesi' },
]

/** Mesi della finestra scelta, o null per "tutto". */
export function mesiPeriodo(p: PeriodoChart): number | null {
  return p === 'anno' ? 12 : p === '6m' ? 6 : p === '3m' ? 3 : null
}
