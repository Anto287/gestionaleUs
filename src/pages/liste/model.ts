export type TipoCampo = 'testo' | 'note' | 'numero' | 'data' | 'booleano' | 'scelta'
export type ValoreCampo = string | number | boolean | null
export interface CampoLista {
  id: string
  nome: string
  tipo: TipoCampo
  obbligatorio: boolean
  opzioni: string[]
}
export interface ListaPersonalizzata {
  id: string
  nome: string
  descrizione: string
  campi: CampoLista[]
}
export interface RigaLista {
  id: string
  listaId: string
  valori: Record<string, ValoreCampo>
}
export const tipiCampo: { value: TipoCampo; label: string }[] = [
  { value: 'testo', label: 'Testo' }, { value: 'note', label: 'Testo lungo' },
  { value: 'numero', label: 'Numero / importo' }, { value: 'data', label: 'Data' },
  { value: 'booleano', label: 'Sì / No' }, { value: 'scelta', label: 'Scelta da elenco' },
]
export function nuovoCampo(): CampoLista {
  return { id: crypto.randomUUID(), nome: '', tipo: 'testo', obbligatorio: false, opzioni: [] }
}
export function erroreSchema(lista: Omit<ListaPersonalizzata, 'id'>): string | undefined {
  if (!lista.nome.trim()) return 'Inserisci il nome della lista.'
  if (!lista.campi.length) return 'Aggiungi almeno un campo alla lista.'
  const nomi = new Set<string>()
  for (const campo of lista.campi) {
    const nome = campo.nome.trim().toLocaleLowerCase('it')
    if (!nome) return 'Ogni campo deve avere un nome.'
    if (nomi.has(nome)) return 'Usa nomi diversi per i campi della stessa lista.'
    nomi.add(nome)
    if (campo.tipo === 'scelta' && !campo.opzioni.length) return `Inserisci almeno una scelta per «${campo.nome}».`
  }
}
export function valoreTesto(campo: CampoLista, valore: ValoreCampo | undefined): string {
  if (valore === undefined || valore === null || valore === '') return ''
  if (campo.tipo === 'booleano') return valore === true ? 'Sì' : 'No'
  if (campo.tipo === 'numero' && typeof valore === 'number') return valore.toLocaleString('it-IT')
  if (campo.tipo === 'data' && typeof valore === 'string') {
    const parti = valore.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return parti ? `${parti[3]}/${parti[2]}/${parti[1]}` : valore
  }
  return String(valore)
}
export function filtraRighe(righe: RigaLista[], campi: CampoLista[], ricerca: string): RigaLista[] {
  const testo = ricerca.trim().toLocaleLowerCase('it')
  return testo ? righe.filter((r) => campi.some((c) => valoreTesto(c, r.valori[c.id]).toLocaleLowerCase('it').includes(testo))) : righe
}
