import { nascitaIso } from './archivio.ts'
import type { Giocatore } from '../types'

// Le ricorrenze precedenti all'introduzione della funzione non generano arretrati.
const INIZIO_PROMEMORIA = '2026-11-26'

const dataItaliana = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function giornoCompleanni(ora = new Date()): string {
  return dataItaliana.format(ora)
}

export function compleanniDaVedere(
  rosa: Giocatore[],
  giorno: string,
  conferme: { id: string }[],
): { id: string; nome: string; data: string }[] {
  const visti = new Set(conferme.map(({ id }) => id))
  const compleanni = rosa.flatMap((persona) => {
    const nascita = nascitaIso(persona.nascita)
    if (!nascita || nascita > giorno || !dataValida(nascita)) return []
    const ricorrenze = []
    const primoAnno = Math.max(Number(INIZIO_PROMEMORIA.slice(0, 4)), Number(nascita.slice(0, 4)))
    for (let anno = primoAnno; anno <= Number(giorno.slice(0, 4)); anno++) {
      const data = `${anno}-${nascita.slice(5)}`
      const id = `${data}:${persona.id}`
      if (data >= INIZIO_PROMEMORIA && data <= giorno && dataValida(data) && !visti.has(id)) {
        ricorrenze.push({ id, nome: `${persona.nome} ${persona.cognome}`.trim(), data })
      }
    }
    return ricorrenze
  })
  return compleanni.sort((a, b) => b.data.localeCompare(a.data))
}

function dataValida(iso: string): boolean {
  const data = new Date(iso)
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === iso
}
