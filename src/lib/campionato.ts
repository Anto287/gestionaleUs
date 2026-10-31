export interface RigaClassifica { squadra: string; punti: number; giocate: number; vinte?: number; pareggiate?: number; perse?: number; golFatti?: number; golSubiti?: number }
export interface GaraCampionato { data: string; casa: string; ospite: string; risultato?: string; stato?: string; giornata?: string }
export interface DatiCampionato { titolo: string; widgetUrl?: string; fonte?: string; aggiornatoIl?: string; classifica: RigaClassifica[]; partite: GaraCampionato[]; note?: string }
/** Il frontend valida anche il payload del server: mai mostrare JSON non previsto. */
export function validaCampionato(value: unknown): DatiCampionato {
  if (!value || typeof value !== 'object') throw new Error('Formato campionato non valido')
  const v = value as DatiCampionato
  if (v.widgetUrl) return { titolo:String(v.titolo || 'Classifica'), fonte:'TuttoCampo', widgetUrl:normalizzaWidgetTuttocampo(v.widgetUrl), classifica:[], partite:[] }
  if (!Array.isArray(v.classifica) || !Array.isArray(v.partite) || v.classifica.length > 100 || v.partite.length > 1000) throw new Error('Servono gli elenchi classifica e partite (massimo 100 squadre e 1000 gare)')
  for (const r of v.classifica) {
    if (!r || typeof r.squadra !== 'string' || !r.squadra.trim() || !Number.isFinite(r.punti) || !Number.isInteger(r.giocate) || r.giocate < 0) throw new Error('Classifica non valida: servono squadra, punti e giocate')
    for (const k of ['vinte','pareggiate','perse','golFatti','golSubiti'] as const) if (r[k] !== undefined && (!Number.isInteger(r[k]) || r[k]! < 0)) throw new Error(`Valore non valido: ${k}`)
  }
  for (const p of v.partite) if (!p || typeof p.casa !== 'string' || typeof p.ospite !== 'string' || typeof p.data !== 'string') throw new Error('Partite non valide: servono data, casa e ospite')
  return { titolo:String(v.titolo || 'Campionato'), fonte:typeof v.fonte === 'string' ? v.fonte : undefined, aggiornatoIl:v.aggiornatoIl, classifica:v.classifica, partite:v.partite, note:typeof v.note === 'string' ? v.note : undefined }
}
export const ESEMPIO_CAMPIONATO = JSON.stringify({ titolo:'UISP Modena · Terza categoria · Girone B', fonte:'Nome della fonte', classifica:[{squadra:'U.S. Riolunato',punti:0,giocate:0,vinte:0,pareggiate:0,perse:0,golFatti:0,golSubiti:0}],partite:[{data:'2026-11-01',casa:'U.S. Riolunato',ospite:'Avversario',stato:'In programma',giornata:'1'}],note:'' }, null, 2)

/** Accetta solo il widget ufficiale della classifica, mai HTML o host arbitrari. */
export function normalizzaWidgetTuttocampo(input: string): string {
  const value = input.trim(), src = /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(value)?.[1] || value
  const match = /^https:\/\/(?:www\.)?tuttocampo\.it\/(Widget(?:V2)?)\/Classifica\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i.exec(src)
  if (!match) throw new Error('Inserisci il link o il codice del widget Classifica fornito da TuttoCampo. Il link normale del girone non è un widget.')
  return `https://www.tuttocampo.it/${match[1]}/Classifica/${match[2]}`
}
