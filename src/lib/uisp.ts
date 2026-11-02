export interface RigaUisp { squadra: string; punti: number; giocate: number; vinte: number; pareggiate: number; perse: number; golFatti: number; golSubiti: number }
export interface RisultatoUisp { id: string; data: string; ora: string; casa: string; ospite: string; golCasa: number; golOspite: number; giornata: string }
export interface PaginaUisp { righe: string[] }
const normalizza = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').replace(/-\s+(?=\d)/g, '-').trim()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Legge soltanto la sezione CAMPIONATO del girone richiesto, mai le coppe. */
export function leggiUisp(pagine: PaginaUisp[], categoria: string, girone: string) {
  if (!/^[1-9]$/.test(categoria) || !/^[A-Z]$/.test(girone)) throw new Error('Categoria o girone non validi')
  const candidate = pagine.filter((p) => {
    const header = normalizza(p.righe.slice(0, p.righe.findIndex((s) => /Partite dal|Classifica/i.test(s))).join(' '))
    return /CALCIO A 11\s*-\s*CAMPIONATO\b/.test(header) && new RegExp(`CATEGORIA ${categoria}\\b`).test(header) && new RegExp(`GIRONE ${girone}\\b`).test(header)
  })
  const righe: RigaUisp[] = [], risultati: RisultatoUisp[] = []
  let avvisoRisultati: string | undefined
  for (const pagina of candidate) {
    const start = pagina.righe.findIndex((r) => /^Classifica(?:\s+P\.?ti\b|$)/i.test(r.trim()))
    if (start < 0) continue
    for (const r of pagina.righe.slice(start + 1)) {
      const m = normalizza(r).match(/^(\d+)\s+(.+?)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)$/)
      if (!m) { if (righe.length && /^Prossimi|Sanzioni|Marcatori|UISP COMITATO/.test(normalizza(r))) break; continue }
      const n = m.slice(3).map(Number)
      if (Number(m[1]) !== righe.length + 1 || n[1] !== n[2] + n[3] + n[4] || n[5] - n[6] !== n[7] || righe.some((r) => r.squadra === m[2])) throw new Error('Formato classifica UISP cambiato: verifica il comunicato originale')
      righe.push({ squadra: m[2], punti: n[0], giocate: n[1], vinte: n[2], pareggiate: n[3], perse: n[4], golFatti: n[5], golSubiti: n[6] })
    }
  }
  if (righe.length < 2) throw new Error(`Il comunicato non contiene una classifica leggibile per Categoria ${categoria}, Girone ${girone}`)
  const nomi = righe.map((r) => r.squadra).sort((a, b) => b.length - a.length)
  const squadre = nomi.map(escape).join('|')
  const match = new RegExp(`^.*?\\b(${squadre})\\s+(${squadre})\\s+(\\d+)\\s+(\\d+)\\s*$`)
  for (const pagina of candidate) {
    let giornata = ''
    for (const line of pagina.righe) {
      const r = normalizza(line)
      if (/^Classifica\b/i.test(r)) break
      if (/^\d+\s*-\s*(ANDATA|RITORNO)/.test(r)) giornata = r
      if (!/^\d{2}\/\d{2}\/\d{4}/.test(r)) continue
      const date = r.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})\s+(.*)$/)
      if (!date) { avvisoRisultati = 'Alcuni risultati non sono leggibili: consulta il comunicato originale.'; continue }
      const teams = date[5].match(match)
      if (!teams) { avvisoRisultati = 'Alcuni risultati non sono leggibili: consulta il comunicato originale.'; continue }
      const data = `${date[3]}-${date[2]}-${date[1]}`
      risultati.push({ id: `${data}|${teams[1]}|${teams[2]}`, data, ora: date[4], casa: teams[1], ospite: teams[2], golCasa: Number(teams[3]), golOspite: Number(teams[4]), giornata })
    }
  }
  return { righe, risultati, avvisoRisultati }
}
