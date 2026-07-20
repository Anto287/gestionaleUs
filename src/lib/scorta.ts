import type { VoceMagazzino } from '../types'

/**
 * Un articolo è "sotto scorta" quando la quantità è scesa alla soglia di
 * riordino impostata (o sotto). Senza soglia non scatta mai: l'esaurito
 * (quantità zero) resta segnalato a parte.
 */
export function sottoScorta(a: VoceMagazzino): boolean {
  return a.scortaMinima != null && a.scortaMinima > 0 && (a.quantita ?? 0) <= a.scortaMinima
}
