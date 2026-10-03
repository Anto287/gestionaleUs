import type { Giocatore, Partita } from '../types'
import type { FormazioneGrafica } from '../pages/social/editor/scene'
import { MODULI } from './formazione'

/** Riprende l'undici iniziale, senza applicare i cambi avvenuti durante la gara. */
export function graficaDaPartita(p: Partita, rosa: Giocatore[]): FormazioneGrafica {
  const byId = new Map(rosa.map((g) => [g.id, g]))
  const modulo = MODULI.find((m) => m.id === p.formazione?.modulo)
  const posti = p.formazione?.posti ?? p.titolari ?? []
  const titolari = posti.flatMap((id, i) => {
    if (!id) return []
    const g = byId.get(id)
    const slot = modulo?.slots[i]
    return [{
      giocatoreId: id,
      nome: g?.cognome || g?.nome || 'Ex tesserato',
      role: slot?.role ?? g?.ruoloPreferito ?? '',
      x: slot?.x ?? 0.5,
      y: slot?.y ?? 0,
      numero: g?.numeroMaglia,
    }]
  })
  const iniziali = new Set(posti.filter(Boolean))
  // Le partite registrano i subentrati, non l'intera lista dei convocati.
  const riserve = [...new Set([
    ...(p.subentrati ?? []),
    ...(p.formazione?.cambi.map((c) => c.entra) ?? []),
  ])].filter((id) => !iniziali.has(id))
  return {
    modulo: modulo?.label ?? p.formazione?.modulo ?? '',
    titolari,
    panchina: riserve.map((id) => {
      const g = byId.get(id)
      const nome = g?.cognome || g?.nome || 'Ex tesserato'
      return g?.numeroMaglia != null ? `${g.numeroMaglia} ${nome}` : nome
    }),
  }
}
