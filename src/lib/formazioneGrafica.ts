import type { Giocatore, Partita } from '../types'
import type { FormazioneGrafica } from '../pages/social/editor/scene'
import { moduloDa } from './formazionePartita'

/** Conserva i titolari iniziali, anche quando la partita contiene sostituzioni. */
export function graficaDaPartita(p: Partita, rosa: Giocatore[]): FormazioneGrafica {
  const modulo = moduloDa(p.formazione?.modulo)
  const posti = p.formazione?.posti ?? p.titolari ?? []
  const byId = new Map(rosa.map((g) => [g.id, g]))
  const nome = (id: string) => byId.get(id)?.cognome || byId.get(id)?.nome || 'Ex tesserato'
  const iniziali = new Set(posti.filter(Boolean))
  const riserve = [...new Set([
    ...(p.formazione?.cambi.map((c) => c.entra) ?? []),
    ...(p.subentrati ?? []),
  ])].filter((id) => !iniziali.has(id))
  return {
    modulo: p.formazione ? modulo.label : 'Non specificato',
    titolari: posti.flatMap((id, i) => {
      if (!id) return []
      const slot = modulo.slots[i] ?? { role: '', x: 0.5, y: i / Math.max(1, posti.length) }
      return [{ ...slot, nome: nome(id), numero: byId.get(id)?.numeroMaglia }]
    }),
    panchina: riserve.map((id) => {
      const numero = byId.get(id)?.numeroMaglia
      return numero != null ? `${numero} ${nome(id)}` : nome(id)
    }),
  }
}
