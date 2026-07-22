/**
 * Palette dei grafici (Recharts), coerente con l'identità giallorossa dell'app.
 * Griglia, assi e testo si adattano al tema attivo (attributo data-tema sul
 * root, vedi TemaProvider): i getter si leggono a ogni render dei grafici.
 */
const scuro = () => typeof document !== 'undefined' && document.documentElement.dataset.tema === 'scuro'

export const COLORI = {
  rosso: '#c22026',
  rossoTenue: 'rgba(194, 32, 38, 0.12)',
  verde: '#3f7a52',
  oro: '#e5a800',
  get griglia() {
    return scuro() ? '#3a3227' : '#ece4d6'
  },
  get asse() {
    return scuro() ? '#59503f' : '#c9bfad'
  },
  get testo() {
    return scuro() ? '#a89c8c' : '#9a948a'
  },
}

/** verde se affluenza alta, oro se media, rosso se bassa */
export function coloreAffluenza(perc: number) {
  if (perc >= 70) return COLORI.verde
  if (perc >= 40) return COLORI.oro
  return COLORI.rosso
}
