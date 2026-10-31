export type TipoColonna = 'testo' | 'numero' | 'euro' | 'data' | 'siNo' | 'scelta' | 'persona'
export interface ColonnaLista { id: string; nome: string; tipo: TipoColonna; opzioni?: string[]; obbligatoria?: boolean }
export interface Lista { id: string; nome: string; descrizione?: string; colonne: ColonnaLista[]; archiviata?: boolean; revisione?: number }
export interface RigaLista { id: string; listaId: string; valori: Record<string, string | number | boolean>; aggiornatoIl: string; aggiornatoDa: string; revisione?: number }
export const TIPI_COLONNA: { value: TipoColonna; label: string }[] = [
  { value: 'testo', label: 'Testo / note' }, { value: 'persona', label: 'Persona / incaricato' },
  { value: 'numero', label: 'Numero' }, { value: 'euro', label: 'Importo €' },
  { value: 'data', label: 'Data' }, { value: 'siNo', label: 'Sì / No' }, { value: 'scelta', label: 'Scelta da elenco' },
]
export function colonneModello(modello: string): ColonnaLista[] {
  const c = (id: string, nome: string, tipo: TipoColonna, opzioni?: string[], obbligatoria = false): ColonnaLista => ({ id, nome, tipo, opzioni, obbligatoria })
  if (modello === 'tombola') return [c('negozio', 'Negozio', 'testo', undefined, true), c('volantino', 'Volantino portato', 'siNo'), c('incaricato', 'Chi deve andare', 'persona'), c('visitatoDa', 'Chi è andato', 'persona'), c('premio', 'Premio offerto', 'testo'), c('valore', 'Valore premio', 'euro'), c('ritirato', 'Premio ritirato', 'siNo'), c('stato', 'Stato', 'scelta', ['Da contattare', 'Da confermare', 'Confermato', 'Non aderisce']), c('note', 'Note', 'testo')]
  if (modello === 'mare') return [c('nome', 'Nome', 'persona', undefined, true), c('presente', 'Confermato', 'siNo'), c('persone', 'Numero persone', 'numero'), c('quota', 'Quota versata', 'euro'), c('note', 'Note', 'testo')]
  return [c('nome', 'Nome', 'testo', undefined, true), c('incaricato', 'Incaricato', 'persona'), c('fatto', 'Fatto', 'siNo'), c('note', 'Note', 'testo')]
}
export function validaValori(colonne: ColonnaLista[], valori: RigaLista['valori']): string | undefined {
  for (const c of colonne) {
    const v = valori[c.id]
    const vuoto = v === undefined || v === ''
    if (c.obbligatoria && vuoto) return `Compila «${c.nome}»`
    if (vuoto) continue
    if ((c.tipo === 'euro' || c.tipo === 'numero') && (typeof v !== 'number' || !Number.isFinite(v))) return `Numero non valido: ${c.nome}`
    if (c.tipo === 'siNo' && typeof v !== 'boolean') return `Scegli Sì o No: ${c.nome}`
    if (c.tipo === 'scelta' && !c.opzioni?.includes(String(v))) return `Scelta non valida: ${c.nome}`
    if (c.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return `Data non valida: ${c.nome}`
  }
}
export function csvLista(lista: Lista, righe: RigaLista[]): string {
  // Evita formule eseguibili quando si apre il CSV con Excel.
  const cella = (v: unknown) => '"' + String(typeof v === 'boolean' ? v ? 'Sì' : 'No' : v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"'
  return '\uFEFF' + [lista.colonne.map(c => cella(c.nome)).join(';'), ...righe.map(r => lista.colonne.map(c => cella(r.valori[c.id])).join(';'))].join('\r\n')
}
