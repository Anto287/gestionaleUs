import type { Movimento } from '../types'

export interface FiltriConti {
  q?: string
  tipo?: string
  stato?: string
  categoria?: string
  controparte?: string
  da?: string
  a?: string
  anno?: string
  mese?: string
  importo?: number | null
  importoOp?: 'maggiore' | 'minore'
  allegati?: boolean
}
export function filtraMovimento(m: Movimento, f: FiltriConti): boolean {
  const testo = `${m.descrizione} ${m.controparte ?? ''}`.toLocaleLowerCase(
    'it',
  )
  if (f.q && !testo.includes(f.q.trim().toLocaleLowerCase('it'))) return false
  if (f.tipo && m.tipo !== f.tipo) return false
  if (f.stato === 'saldato' && !m.saldato) return false
  if (f.stato === 'aperto' && m.saldato) return false
  if (f.anno && !m.data.startsWith(f.anno)) return false
  if (f.mese && !m.data.startsWith(f.mese)) return false
  if ((f.da && m.data < f.da) || (f.a && m.data > f.a)) return false
  if (f.categoria === 'Senza categoria' && m.categoria?.trim()) return false
  if (
    f.categoria &&
    f.categoria !== 'Senza categoria' &&
    m.categoria?.trim() !== f.categoria
  )
    return false
  if (f.controparte && m.controparte?.trim() !== f.controparte) return false
  if (
    f.importo != null &&
    (f.importoOp === 'minore' ? m.importo > f.importo : m.importo < f.importo)
  )
    return false
  if (f.allegati && !m.allegati?.length) return false
  return true
}
const cent = (n: number) => Math.round(n * 100) / 100 || 0
export function totaliReport(items: Movimento[]) {
  const somma = (tipo: Movimento['tipo'], saldato: boolean) =>
    cent(
      items
        .filter((m) => m.tipo === tipo && m.saldato === saldato)
        .reduce((s, m) => s + m.importo, 0),
    )
  const entrate = somma('entrata', true),
    uscite = somma('uscita', true)
  return {
    entrate,
    uscite,
    netto: cent(entrate - uscite),
    daIncassare: somma('entrata', false),
    daPagare: somma('uscita', false),
  }
}
