/** Aggancio fra le schede avversari e le partite: per nome, senza badare a maiuscole e spazi. */
import type { Avversario, Partita } from '../types'

export function normalizzaNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function schedaDi(avversari: Avversario[], nome: string): Avversario | undefined {
  const n = normalizzaNome(nome)
  return avversari.find((a) => normalizzaNome(a.nome) === n)
}

export function partiteContro(partite: Partita[], nome: string): Partita[] {
  const n = normalizzaNome(nome)
  return partite
    .filter((p) => normalizzaNome(p.avversario) === n)
    .sort((a, b) => b.data.localeCompare(a.data))
}

export interface Bilancio {
  vinte: number
  pari: number
  perse: number
  golFatti: number
  golSubiti: number
}

/** Bilancio delle partite giocate (quelle in programma non contano). */
export function bilancio(partite: Partita[]): Bilancio {
  const b: Bilancio = { vinte: 0, pari: 0, perse: 0, golFatti: 0, golSubiti: 0 }
  for (const p of partite) {
    if (p.giocata === false) continue
    if (p.golFatti > p.golSubiti) b.vinte++
    else if (p.golFatti < p.golSubiti) b.perse++
    else b.pari++
    b.golFatti += p.golFatti
    b.golSubiti += p.golSubiti
  }
  return b
}

/** Avversari delle partite che non hanno ancora una scheda. */
export function senzaScheda(avversari: Avversario[], partite: Partita[]): string[] {
  const visti = new Map<string, string>()
  for (const p of partite) {
    const nome = p.avversario?.trim()
    if (!nome || schedaDi(avversari, nome)) continue
    const n = normalizzaNome(nome)
    if (!visti.has(n)) visti.set(n, nome)
  }
  return [...visti.values()].sort((a, b) => a.localeCompare(b))
}

/** Caratteristiche proposte per i giocatori avversari (se ne possono scrivere altre). */
export const CARATTERISTICHE = [
  'Mancino',
  'Veloce',
  'Forte di testa',
  'Tecnico',
  'Fisico',
  'Tiro da fuori',
  'Calci piazzati',
  'Dribbling',
  'Falloso',
  'Nervoso',
  'Lento',
  'Capitano',
]
