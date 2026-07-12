/** Ruoli in codice stile FIFA, raggruppati per reparto. */

export type Area = 'Portiere' | 'Difesa' | 'Centrocampo' | 'Attacco'

export interface RuoloDef {
  code: string
  label: string
  area: Area
}

export const RUOLI_FIFA: RuoloDef[] = [
  { code: 'POR', label: 'Portiere', area: 'Portiere' },
  { code: 'TD', label: 'Terzino destro', area: 'Difesa' },
  { code: 'DC', label: 'Difensore centrale', area: 'Difesa' },
  { code: 'TS', label: 'Terzino sinistro', area: 'Difesa' },
  { code: 'CDC', label: 'Mediano', area: 'Centrocampo' },
  { code: 'CC', label: 'Centrocampista centrale', area: 'Centrocampo' },
  { code: 'COC', label: 'Trequartista', area: 'Centrocampo' },
  { code: 'ED', label: 'Esterno destro', area: 'Centrocampo' },
  { code: 'ES', label: 'Esterno sinistro', area: 'Centrocampo' },
  { code: 'AD', label: 'Ala destra', area: 'Attacco' },
  { code: 'AS', label: 'Ala sinistra', area: 'Attacco' },
  { code: 'SP', label: 'Seconda punta', area: 'Attacco' },
  { code: 'ATT', label: 'Attaccante', area: 'Attacco' },
]

export const RUOLO_BY_CODE: Record<string, RuoloDef> = Object.fromEntries(
  RUOLI_FIFA.map((r) => [r.code, r]),
)

export const AREA_ORDER: Record<Area, number> = {
  Portiere: 0,
  Difesa: 1,
  Centrocampo: 2,
  Attacco: 3,
}

export const AREA_COLOR: Record<Area, string> = {
  Portiere: 'gold',
  Difesa: 'blue',
  Centrocampo: 'green',
  Attacco: 'red',
}

/** Colore antd del tag per un codice ruolo. */
export function coloreRuolo(code?: string): string | undefined {
  if (!code) return undefined
  const area = RUOLO_BY_CODE[code]?.area
  return area ? AREA_COLOR[area] : 'default'
}

/** Ordine (per ordinare la rosa) del codice ruolo. */
export function ordineRuolo(code?: string): number {
  const area = code ? RUOLO_BY_CODE[code]?.area : undefined
  return area ? AREA_ORDER[area] : 99
}

/** Opzioni per i Select. */
export const OPZIONI_RUOLI = RUOLI_FIFA.map((r) => ({
  value: r.code,
  label: `${r.code} — ${r.label}`,
}))
